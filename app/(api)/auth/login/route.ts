import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { signToken, generateRefreshToken } from "@/lib/jwt";
import { setAuthCookie, setRefreshCookie, isSecureRequest } from "@/lib/auth-guard";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter";
import { getRequestMeta, logEvent } from "@/lib/logger";
import { randomUUID } from "crypto";

const departmentToRedirect: Record<string, string> = {
  PRICE: "/operators/price-expert",
  SELL: "/operators/sales-expert",
  PRODUCT: "/operators/product-expert",
  INVESTMENT: "/operators/investment-expert",
};

export async function POST(req: NextRequest) {
  try {
    const { ip, userAgent, requestId } = getRequestMeta(req, "/api/operator/auth", "POST");

    // Rate limit by IP + username pair
    let username: string;
    let password: string;
    try {
      const body = (await req.json()) as { username?: string; password?: string };
      username = typeof body?.username === "string" ? body.username : "";
      password = typeof body?.password === "string" ? body.password : "";
    } catch {
      return NextResponse.json(
        { error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    const rateKey = `login:${ip}:${username}`;
    const rateLimit = checkRateLimit(rateKey, { windowMs: 60_000, max: 5 });
    const headers = getRateLimitHeaders({ windowMs: 60_000, max: 5 }, rateLimit);

    if (!rateLimit.allowed) {
      logEvent("warn", {
        event: "login_rate_limited",
        path: "/api/operator/auth",
        method: "POST",
        role: "operator",
        userId: undefined,
        email: username,
        ip, userAgent, requestId,
        status: 429,
        reason: "rate_limit",
      });
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { agentProfile: true },
    });

    if (!user || !user.active) {
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401, headers }
      );
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401, headers }
      );
    }

    const roleAssignment = await prisma.userRoleAssignment.findFirst({
      where: { userId: user.id },
      include: { role: true },
    });

    const roleCode = roleAssignment?.role?.code?.toLowerCase();
    const isOperatorRole = roleCode === "operator";

    if (!isOperatorRole) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers }
      );
    }

    if (!user.agentProfile || !user.agentProfile.active) {
      return NextResponse.json(
        { error: "Operator profile inactive or missing" },
        { status: 403, headers }
      );
    }

    const department = user.agentProfile.department;
    const redirectUrl = departmentToRedirect[department];
    if (!redirectUrl) {
      return NextResponse.json(
        { error: "Invalid operator department" },
        { status: 403, headers }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const refreshFamily = randomUUID();
    const sessionId = randomUUID();
    const { rawToken: rawRefreshToken, hash: refreshHash } = generateRefreshToken();

    const [session] = await prisma.$transaction([
      prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshFamily,
          userAgent: userAgent ?? undefined,
          ipAddress: ip ?? undefined,
          lastUsedAt: new Date(),
        },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          sessionId,
          tokenHash: refreshHash,
          family: refreshFamily,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    const token = await signToken({
      sub: user.id,
      role: "operator",
      username: user.username,
      userType: "AGENT",
      departmentId: department as unknown as string | null,
      tokenVersion: (user as any).tokenVersion ?? 0,
      sessionId,
    });

    logEvent("info", {
      event: "login_success",
      path: "/api/operator/auth",
      method: "POST",
      role: "operator",
      userId: user.id,
      email: username,
      ip, userAgent, requestId,
      status: 200,
      reason: "ok",
      departmentId: department,
    });

    const secure = isSecureRequest(req);
    const response = NextResponse.json({
      success: true,
      role: "operator",
      redirectUrl,
      user: { id: user.id, username: user.username },
    }, { headers });

    setAuthCookie(response, token, secure);
    setRefreshCookie(response, rawRefreshToken, secure);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "خطای سرور" },
      { status: 500 }
    );
  }
}