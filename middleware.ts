import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, JWTPayload } from "jose";
import { getLandingPage, isAllowedPath } from "@/lib/auth-routing";
import { start, elapsed, log } from "@/lib/auth-perf";

type AuthPayload = JWTPayload & {
  sub?: string;
  role?: string;
  username?: string;
  userType?: "ADMIN" | "AGENT";
  departmentId?: string | null;
  tokenVersion?: number;
  sessionId?: string;
};

const secretValue = process.env.JWT_SECRET;

async function verifyAuthToken(token: string): Promise<AuthPayload | null> {
  if (!secretValue || typeof secretValue !== "string") return null;

  try {
    const secret = new TextEncoder().encode(secretValue);
    const t0 = start();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    log("middleware_jwt_verify", elapsed(t0));
    return payload as AuthPayload;
  } catch {
    return null;
  }
}

// Clear both auth cookies on a response (stale-cookie loop breaker).
// Uses identical attributes as the setters in lib/auth-guard.ts so the
// browser actually overwrites/deletes the existing cookies.
function clearStaleAuthCookies(response: NextResponse): void {
  response.cookies.set("token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 0,
  });
}

function extractToken(request: NextRequest): string | undefined {
  return request.cookies.get("token")?.value;
}

function buildLoginRedirect(request: NextRequest, pathname: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return loginUrl;
}

// Protected UI route prefixes
const PROTECTED_PREFIXES = [
  "/admin",
  "/agent",
  "/operator",
  "/operators",
  "/operatorsadmins",
  "/user",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// All role prefixes and which roles can access them
const ROLE_PREFIX_MAP: Record<string, string[]> = {
  "/admin": ["admin"],
  "/agent": ["agent", "operator"], // AGENT users have token role "operator"
  "/operator": ["operator", "admin"],
  "/operators": ["operator", "admin"],
  "/operatorsadmins": ["admin"],
  "/user": ["user", "agent", "admin"],
};

function getPathPrefix(pathname: string): string | null {
  for (const prefix of PROTECTED_PREFIXES) {
    if (pathname.startsWith(prefix)) return prefix;
  }
  return null;
}

function buildUserInput(payload: AuthPayload) {
  return {
    username: payload.username ?? "",
    role: payload.role ?? "user",
    userType: payload.userType ?? ("AGENT" as const),
    adminDepartment: payload.departmentId ?? null,
    agentDepartment: payload.departmentId ?? null,
  };
}

export async function middleware(request: NextRequest) {
  // ── CSRF double-submit cookie enforcement ────────────────────
  {
    const CSRF_MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
    const CSRF_EXEMPT = [
      "/api/operator/auth",
      "/api/auth/enduser",
      "/api/auth/refresh",
      "/api/auth/csrf",
      "/api/forms",
      "/api/investments",
    ];
    const csrfPath = request.nextUrl.pathname;
    const csrfExempt = CSRF_EXEMPT.some((x) => csrfPath.startsWith(x));

    if (
      CSRF_MUTATING.has(request.method) &&
      csrfPath.startsWith("/api/") &&
      !csrfExempt
    ) {
      const cookieToken = request.cookies.get("csrf_token")?.value;
      const headerToken = request.headers.get("x-csrf-token");
      if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return NextResponse.json({ error: "csrf_invalid" }, { status: 403 });
      }
    }
  }

  const t0 = start();
  const { pathname } = request.nextUrl;

  // Step 0: Session-clearing paths — wipe token and redirect to /login
  if (pathname === "/logout" || pathname === "/switch-account" || pathname === "/relogin") {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("token", "", { maxAge: 0, path: "/" });
    log("middleware_total", elapsed(t0), { pathname, outcome: "session_clear" });
    return response;
  }

  if (pathname === "/login") {
    // Circuit breaker: an explicit force-login request must never bounce back.
    // Used by the client after a 401 to guarantee the loop cannot restart.
    const force = request.nextUrl.searchParams.get("force") === "1";
    if (force) {
      log("middleware_total", elapsed(t0), { pathname, outcome: "force_login_clear" });
      const response = NextResponse.next();
      clearStaleAuthCookies(response);
      return response;
    }

    const token = extractToken(request);
    if (token) {
      const payload = await verifyAuthToken(token);
      if (payload && payload.role) {
        const loginLanding = getLandingPage(buildUserInput(payload));
        if (loginLanding !== "/login") {
          log("middleware_total", elapsed(t0), { pathname, outcome: "redirect_from_login" });
          return NextResponse.redirect(new URL(loginLanding, request.url));
        }
        log("middleware_total", elapsed(t0), { pathname, outcome: "next_from_login" });
        return NextResponse.next();
      } else {
        log("middleware_total", elapsed(t0), { pathname, outcome: "clear_invalid_token" });
        const response = NextResponse.next();
        clearStaleAuthCookies(response);
        return response;
      }
    }
    log("middleware_total", elapsed(t0), { pathname, outcome: "next_no_token" });
    return NextResponse.next();
  }

  // Only process protected UI routes
  if (!isProtectedPath(pathname)) {
    log("middleware_total", elapsed(t0), { pathname, outcome: "skip_unprotected" });
    return NextResponse.next();
  }

  const token = extractToken(request);

  if (!token) {
    // Protected route, no token -> redirect to login
    log("middleware_total", elapsed(t0), { pathname, outcome: "redirect_no_token" });
    return NextResponse.redirect(buildLoginRedirect(request, pathname));
  }

  const payload = await verifyAuthToken(token);

  if (!payload || !payload.role) {
    // Invalid token -> redirect to login AND clear both cookies on the
    // redirect response. Without this, a stale-but-cryptographically-valid
    // cookie survives the redirect and produces a loop:
    // protected route -> 401 -> /login -> middleware sees "valid" token ->
    // back to protected route -> ...
    const response = NextResponse.redirect(buildLoginRedirect(request, pathname));
    clearStaleAuthCookies(response);
    log("middleware_total", elapsed(t0), { pathname, outcome: "redirect_invalid_token_cleared" });
    return response;
  }

  const role = payload.role;
  const pathPrefix = getPathPrefix(pathname);

  // Step 2: Check basic role-prefix access
  if (pathPrefix) {
    const allowedRoles = ROLE_PREFIX_MAP[pathPrefix];
    if (!allowedRoles.includes(role)) {
      // Cross-role unauthorized: redirect to user's landing page
      const landing = getLandingPage(buildUserInput(payload));
      log("middleware_total", elapsed(t0), { pathname, outcome: "redirect_cross_role" });
      return NextResponse.redirect(new URL(landing, request.url));
    }
  }

  // Step 3: Strict path-level access enforcement
  // Ensures users are on their correct landing page, not just the right role prefix
  const userInput = buildUserInput(payload);
  if (!isAllowedPath(userInput, pathname)) {
    const landing = getLandingPage(userInput);
    log("middleware_total", elapsed(t0), { pathname, outcome: "redirect_not_allowed" });
    return NextResponse.redirect(new URL(landing, request.url));
  }

  log("middleware_total", elapsed(t0), { pathname, outcome: "next_authorized" });
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect UI routes:
     * API routes (/api/*) are NOT handled by this middleware.
     * They are protected by explicit auth guards in each route handler
     * using lib/auth-guard.ts (requireAuth, requireRole, requirePermission).
     * 
     * Only UI page routes go through middleware for role-based redirects.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public|buy|sell|invest|search|terms|webhook).*)",
  ],
};
