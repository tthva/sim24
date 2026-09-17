import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { signToken, generateRefreshToken } from "@/lib/jwt";
import { setAuthCookie, setRefreshCookie, isSecureRequest } from "@/lib/auth-guard";
import { randomUUID } from "crypto";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter-redis";
import { start, elapsed, log } from "@/lib/auth-perf";

export async function POST(req: NextRequest) {
  const t0 = start();
    try {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const { username, password } = await req.json();
    // Rate limit per IP + username so shared mobile IPs can't block each other
    const rlStart = start();
    const rl = await checkRateLimit(`enduser-login:${ip}:${username ?? ""}`, {
      windowMs: 15 * 60 * 1000,
      max: 10,
      keyPrefix: "rl",
    });
    log("enduser_login_rate_limit", elapsed(rlStart));
    if (!rl.allowed) {
      log("enduser_login_total", elapsed(t0), { outcome: "rate_limited" });
      return NextResponse.json(
        { error: "تلاش‌های زیادی انجام شده. لطفاً بعداً تلاش کنید." },
        { status: 429, headers: getRateLimitHeaders({ windowMs: 15 * 60 * 1000, max: 10 }, rl) }
      );
    }

    
    if (!username || !password) {
      log("enduser_login_total", elapsed(t0), { outcome: "missing_credentials" });
      return NextResponse.json(
        { error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    const userLookupStart = start();
    const user = await prisma.endUser.findUnique({ where: { username } });
    log("enduser_login_user_lookup", elapsed(userLookupStart));
    if (!user || !user.active) {
      log("enduser_login_total", elapsed(t0), { outcome: "invalid_credentials" });
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    const hashStart = start();
    const valid = await comparePassword(password, user.password);
    log("enduser_login_hash_compare", elapsed(hashStart));
    if (!valid) {
      log("enduser_login_total", elapsed(t0), { outcome: "invalid_credentials" });
      return NextResponse.json(
        { error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    // Determine landing page based on username
    const landingMap: Record<string, string> = {
      user1: "/user/Investment",
      user2: "/user/prepay",
    };
    const redirectUrl = landingMap[username] || "/user/Investment";

    const secure = isSecureRequest(req);

    // Phase 4: Create session + refresh token
    const sessionId = randomUUID();
    const refreshFamily = randomUUID();
    const { rawToken: rawRefreshToken, hash: refreshHash } = generateRefreshToken();

    // Save session to database
    const sessionStart = start();
    try {
      await prisma.session.create({
        data: {
          id: sessionId,
          userId: null,  // No User record for EndUsers
          endUserId: user.id,  // Link to EndUser
          refreshFamily,
          userAgent: userAgent ?? null,
          ipAddress: ip ?? null,
          lastUsedAt: new Date(),
        },
      });

      // Save refresh token hash
      await prisma.refreshToken.create({
        data: {
          tokenHash: refreshHash,
          userId: null,  // No User record for EndUsers
          endUserId: user.id,  // Link to EndUser
          sessionId,
          family: refreshFamily,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch {
      log("enduser_login_session_create", elapsed(sessionStart));
      log("enduser_login_total", elapsed(t0), { outcome: "session_error" });
      return NextResponse.json(
        { error: "خطای سرور" },
        { status: 500 }
      );
    }
    log("enduser_login_session_create", elapsed(sessionStart));

    const jwtStart = start();
    const token = await signToken({
      sub: user.id,
      role: "user",
      username: user.username,
      userType: "AGENT",
      departmentId: null,
      tokenVersion: 0,
      sessionId,
    });
    log("enduser_login_jwt_sign", elapsed(jwtStart));

    const response = NextResponse.json({
      success: true,
      role: "user",
      redirectUrl,
      user: { id: user.id, username: user.username },
    });

    setAuthCookie(response, token, secure);
    setRefreshCookie(response, rawRefreshToken, secure);

    log("enduser_login_total", elapsed(t0), { outcome: "success" });
    return response;
  } catch (error) {
    console.error("EndUser login error:", error);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}