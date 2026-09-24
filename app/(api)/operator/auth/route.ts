import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/password";
import { signToken, generateRefreshToken } from "@/lib/jwt";
import { getRequestMeta, logEvent } from "@/lib/logger";
import { getLandingPage } from "@/lib/auth-routing";
import { setAuthCookie, setRefreshCookie, clearAuthCookie, isSecureRequest } from "@/lib/auth-guard";
import { setCsrfCookie } from "@/lib/csrf";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter-redis";
import { randomUUID } from "crypto";
import { start, elapsed, log } from "@/lib/auth-perf";

export async function POST(request: NextRequest) {
  const t0 = start();
  try {
        const { ip, userAgent, requestId } = getRequestMeta(
      request,
      "/api/operator/auth",
      "POST"
    );

    type LoginBody = { username?: string; password?: string };

    let username: string | undefined;
    let password: string | undefined;

    // Parse body first so we can include username in the rate-limit key
    // (IP-only keying blocks shared mobile IPs — see enduser route).
    const parseStart = start();
    try {
      const body = (await request.json()) as LoginBody;
      username = typeof body?.username === "string" ? body.username : undefined;
      password = typeof body?.password === "string" ? body.password : undefined;
    } catch {
      log("operator_login_parse", elapsed(parseStart));
      logEvent("warn", {
        event: "login_failure",
        path: "/api/operator/auth",
        method: "POST",
        role: "operator",
        email: undefined,
        ip, userAgent, requestId,
        status: 400,
        reason: "invalid_request_body",
      });
      log("operator_login_total", elapsed(t0), { outcome: "bad_request" });
      return NextResponse.json(
        { success: false, error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }
    log("operator_login_parse", elapsed(parseStart));

    // Rate limit per IP + username so shared mobile IPs can't block each other
    const rlStart = start();
    const rl = await checkRateLimit(`operator-login:${ip}:${username ?? ""}`, {
      windowMs: 15 * 60 * 1000,
      max: 10,
      keyPrefix: "rl",
    });
    log("operator_login_rate_limit", elapsed(rlStart));
    if (!rl.allowed) {
      log("operator_login_total", elapsed(t0), { outcome: "rate_limited" });
      return NextResponse.json(
        { success: false, error: "تلاش‌های زیادی انجام شده. لطفاً بعداً تلاش کنید." },
        { status: 429, headers: getRateLimitHeaders({ windowMs: 15 * 60 * 1000, max: 10 }, rl) }
      );
    }

    logEvent("info", {
      event: "login_attempt",
      path: "/api/operator/auth",
      method: "POST",
      role: "operator",
      userId: undefined,
      email: username ? String(username) : undefined,
      ip, userAgent, requestId,
      status: 0,
      reason: !username || !password ? "missing_credentials_fields" : "intent",
    });

    if (!username || !password) {
      log("operator_login_total", elapsed(t0), { outcome: "missing_credentials" });
      return NextResponse.json(
        { success: false, error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    const userLookupStart = start();
    const user = await prisma.user.findUnique({
      where: { username },
      // Fetch user first; profiles are loaded lazily below based on userType
    });
    log("operator_login_user_lookup", elapsed(userLookupStart));

    if (!user) {
      logEvent("warn", {
        event: "login_failure",
        path: "/api/operator/auth",
        method: "POST",
        role: "operator",
        email: String(username),
        ip, userAgent, requestId,
        status: 401,
        reason: "invalid_credentials",
      });
      return NextResponse.json(
        { success: false, error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    const hashStart = start();
    const valid = await comparePassword(password, user.password);
    log("operator_login_hash_compare", elapsed(hashStart));
    if (!valid) {
      logEvent("warn", {
        event: "login_failure",
        path: "/api/operator/auth",
        method: "POST",
        role: "operator",
        userId: user.id,
        email: String(username),
        ip, userAgent, requestId,
        status: 401,
        reason: "invalid_credentials",
      });
      log("operator_login_total", elapsed(t0), { outcome: "invalid_credentials" });
      return NextResponse.json(
        { success: false, error: "نام کاربری یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    // Fetch only the profile we actually need based on userType
    const profileStart = start();
    let profile: { id: string; department?: string; active?: boolean } | null = null;
    if (user.userType === "ADMIN") {
      profile = await prisma.admin.findUnique({
        where: { userId: user.id },
        select: { id: true, department: true },
      });
    } else if (user.userType === "AGENT") {
      profile = await prisma.agent.findFirst({
        where: { userId: user.id },
        select: { id: true, department: true, active: true },
      });
    }
    log("operator_login_profile_lookup", elapsed(profileStart));

    // Phase 4.8b-3: does this user hold a CRM DB role?
    // CRM-only users (e.g. crm_tester) must land at /crm instead of the
    // department/role fallback (getLandingPage checks this flag before
    // the operator/admin fallbacks, but after the username fast path).
    const crmRoleStart = start();
    const crmRole = await prisma.role.findFirst({
      where: {
        code: { in: ["crm_manager", "crm_operator"] },
        assignments: { some: { userId: user.id } },
      },
      select: { code: true },
    });
    log("operator_login_crm_role_lookup", elapsed(crmRoleStart));
    const hasCrmAccess = !!crmRole;

    const secure = isSecureRequest(request);

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
          userId: user.id,
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
          userId: user.id,
          sessionId,
          family: refreshFamily,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch (e) {
      log("operator_login_session_create", elapsed(sessionStart));
      logEvent("error", {
        event: "login_failure",
        path: "/api/operator/auth",
        method: "POST",
        role: "operator",
        userId: user.id,
        email: String(username),
        ip, userAgent, requestId,
        status: 500,
        reason: "session_creation_failed",
      });
      log("operator_login_total", elapsed(t0), { outcome: "session_error" });
      return NextResponse.json(
        { success: false, error: "خطای سرور" },
        { status: 500 }
      );
    }
    log("operator_login_session_create", elapsed(sessionStart));

    if (user.userType === "ADMIN") {
      if (!profile) {
        logEvent("warn", {
          event: "login_failure",
          path: "/api/operator/auth",
          method: "POST",
          role: "admin",
          userId: user.id,
          email: String(username),
          ip, userAgent, requestId,
          status: 401,
          reason: "inactive_user",
        });
        return NextResponse.json(
          { success: false, error: "نام کاربری یا رمز عبور اشتباه است" },
          { status: 401 }
        );
      }

      const jwtStart = start();
      const token = await signToken({
        sub: user.id,
        role: "admin",
        username: user.username,
        userType: "ADMIN",
        departmentId: profile.department ?? null,
        tokenVersion: (user as any).tokenVersion ?? 0,
        sessionId,
      });
      log("operator_login_jwt_sign", elapsed(jwtStart));

      const redirectUrl = getLandingPage({
        username: user.username,
        role: "admin",
        userType: "ADMIN",
        adminDepartment: profile.department ?? null,
        agentDepartment: null,
        hasCrmAccess,
      });

      const response = NextResponse.json({
        success: true,
        user: { id: user.id, username: user.username, role: "admin", department: profile.department ?? null },
        redirectUrl,
      });

            setAuthCookie(response, token, secure);
      setRefreshCookie(response, rawRefreshToken, secure);
      setCsrfCookie(response, undefined, secure);

      logEvent("info", {
        event: "login_success",
        path: "/api/operator/auth",
        method: "POST",
        role: "admin",
        userId: user.id,
        email: String(username),
        ip, userAgent, requestId,
        status: 200,
        reason: "ok",
      });

      log("operator_login_total", elapsed(t0), { outcome: "success_admin" });
      return response;
    }

    if (user.userType === "AGENT") {
      if (!profile || profile.active === false) {
        logEvent("warn", {
          event: "login_failure",
          path: "/api/operator/auth",
          method: "POST",
          role: "operator",
          userId: user.id,
          email: String(username),
          ip, userAgent, requestId,
          status: 401,
          reason: "inactive_user",
        });
        return NextResponse.json(
          { success: false, error: "نام کاربری یا رمز عبور اشتباه است" },
          { status: 401 }
        );
      }

      const department = profile.department;
      const finalRedirectUrl = getLandingPage({
        username: user.username,
        role: "operator",
        userType: "AGENT",
        agentDepartment: department,
        adminDepartment: null,
        hasCrmAccess,
      });

      const jwtStart = start();
      const token = await signToken({
        sub: user.id,
        role: "operator",
        username: user.username,
        userType: "AGENT",
        departmentId: (department as any) ?? null,
        tokenVersion: (user as any).tokenVersion ?? 0,
        sessionId,
      });
      log("operator_login_jwt_sign", elapsed(jwtStart));

      const response = NextResponse.json({
        success: true,
        user: { id: profile.id, username: user.username, role: "operator", department: department ?? null },
        redirectUrl: finalRedirectUrl,
      });

            setAuthCookie(response, token, secure);
      setRefreshCookie(response, rawRefreshToken, secure);
      setCsrfCookie(response, undefined, secure);

      logEvent("info", {
        event: "login_success",
        path: "/api/operator/auth",
        method: "POST",
        role: "operator",
        userId: user.id,
        email: String(username),
        ip, userAgent, requestId,
        status: 200,
        reason: "ok",
        departmentId: department ?? null,
      });

      log("operator_login_total", elapsed(t0), { outcome: "success_agent" });
      return response;
    }

    logEvent("warn", {
      event: "login_failure",
      path: "/api/operator/auth",
      method: "POST",
      role: "operator",
      userId: user.id,
      email: String(username),
      ip, userAgent, requestId,
      status: 403,
      reason: "invalid_user_type",
    });

    log("operator_login_total", elapsed(t0), { outcome: "invalid_user_type" });
    return NextResponse.json(
      { success: false, error: "نام کاربری یا رمز عبور اشتباه است" },
      { status: 403 }
    );
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown_error";
    logEvent("error", {
      event: "login_failure",
      path: "/api/operator/auth",
      method: "POST",
      role: "operator",
      status: 500,
      reason: "server_error",
      error: errMsg,
    });
    log("operator_login_total", elapsed(t0), { outcome: "server_error" });
    return NextResponse.json({ success: false, error: "خطای سرور" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const secure = isSecureRequest(request);
  const { ip, userAgent, requestId } = getRequestMeta(request, "/api/operator/auth", "DELETE");
  logEvent("info", {
    event: "logout",
    path: "/api/operator/auth",
    method: "DELETE",
    role: "operator",
    ip, userAgent, requestId,
    status: 200,
    reason: "ok",
  });
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response, secure);
  return response;
}