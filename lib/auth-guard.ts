// ============================
// SIM24 — Unified Auth Guard Utilities
// ============================
// Provides shared authentication & authorization helpers for API routes.
// Design principles:
// - Fail-closed: all guards return 401/403 by default
// - Phase 3 compatible: permission checks are DB-driven via lib/rbac.ts
// - No client-trusted input: user identity comes ONLY from JWT cookie
// ============================

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, JwtPayload } from "@/lib/jwt";
import { errorResponse } from "@/lib/types/api";
import { prisma } from "@/lib/prisma";
import {
  hasPermission,
  hasRole,
  getUserPermissions,
} from "@/lib/rbac";
import {
  getCachedTokenVersion,
  setCachedTokenVersion,
} from "@/lib/auth-cache";
import { start, elapsed, log } from "@/lib/auth-perf";

export type AuthUser = JwtPayload;

// ─── Config ────────────────────────────────────────────────────

const RBAC_FALLBACK_ENABLED =
  process.env.RBAC_FALLBACK_ENABLED === "true" ||
  process.env.RBAC_FALLBACK_ENABLED === "1";

const FALLBACK_PERMISSIONS: Record<string, string[]> = {
  admin: ["*"],
  operator: [
    "workflow.create", "workflow.read", "workflow.complete",
    "workflow.reassign", "workflow.timeline",
    "customerform.read", "customerform.assign",
  ],
  agent: ["customerform.read", "customerform.create"],
  user: ["customerform.create"],
};

export async function getCurrentUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const token = request.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const t0 = start();
    const result = await verifyToken(token);
    log("auth_guard_jwt_verify", elapsed(t0));
    return result;
  } catch {
    return null;
  }
}

// ─── Sentinel ──────────────────────────────────────────────────

const DB_FAILURE_SENTINEL = Symbol("db_failure");

export async function resolveUserPermissions(
  userId: string,
  jwtRole: string
): Promise<string[]> {
  let dbResult: string[] | typeof DB_FAILURE_SENTINEL;
  try {
    const perms = await getUserPermissions(userId);
    dbResult = perms;
  } catch {
    dbResult = DB_FAILURE_SENTINEL;
  }
  if (dbResult !== DB_FAILURE_SENTINEL) return dbResult;
  if (!RBAC_FALLBACK_ENABLED) {
    console.warn(`[AUTH] RBAC DB failure for userId=${userId}, jwtRole=${jwtRole}. Fallback disabled.`);
    return [];
  }
  console.warn(`[AUTH] RBAC DB failure for userId=${userId}, jwtRole=${jwtRole}. Fallback ENABLED.`);
  return FALLBACK_PERMISSIONS[jwtRole] ?? [];
}

// ─── Auth result type ──────────────────────────────────────────

type AuthResult =
  | { user: AuthUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

/**
 * requireAuth: Phase 4 — validates JWT signature + tokenVersion + session status.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await getCurrentUser(request);
  if (!user) {
    return {
      response: NextResponse.json(
        errorResponse("Authentication required", null, "UNAUTHORIZED"),
        { status: 401 }
      ),
    };
  }

  if (user.role === "user") {
    // EndUser authentication path — check end_users table
    try {
      const endUserStart = start();
      const dbUser = await prisma.endUser.findUnique({
        where: { id: user.sub },
        select: { active: true },
      });
      log("auth_guard_enduser_lookup", elapsed(endUserStart));
      if (!dbUser || !dbUser.active) {
        return {
          response: NextResponse.json(
            errorResponse("Account inactive or not found", null, "UNAUTHORIZED"),
            { status: 401 }
          ),
        };
      }
    } catch {
      return {
        response: NextResponse.json(
          errorResponse("Authentication service unavailable", null, "UNAUTHORIZED"),
          { status: 401 }
        ),
      };
    }
  } else {
    // Operator/Admin/Agent authentication path — check users table.
    // Redis-cached tokenVersion (60s TTL) fast-path:
    //  - cache HIT + match  → skip the DB user lookup entirely (60s TTL bounds
    //    how long an `active=false` change can ride through — accepted trade-off)
    //  - cache HIT + differ → DB was bumped (logout-all / theft revocation);
    //    reject immediately WITHOUT touching the DB. This is what closes the
    //    redirect-loop window after a tokenVersion bump.
    //  - cache MISS (cold or Redis down) → fall through to the DB exactly as
    //    before, so a Redis outage changes nothing (fail-closed to DB).
    try {
      const cachedTV = await getCachedTokenVersion(user.sub);
      if (cachedTV !== null) {
        if (cachedTV !== user.tokenVersion) {
          log("auth_guard_tv_cache", 0, { outcome: "stale_token_cache_hit" });
          return {
            response: NextResponse.json(
              errorResponse("Token revoked. Please re-login.", null, "TOKEN_REVOKED"),
              { status: 401 }
            ),
          };
        }
        // cache hit & match — proceed without the DB user lookup
      } else {
        const userStart = start();
        const dbUser = await prisma.user.findUnique({
          where: { id: user.sub },
          select: { tokenVersion: true, active: true },
        });
        log("auth_guard_user_lookup", elapsed(userStart));
        if (!dbUser || !dbUser.active) {
          return {
            response: NextResponse.json(
              errorResponse("Account inactive or not found", null, "UNAUTHORIZED"),
              { status: 401 }
            ),
          };
        }
        if (dbUser.tokenVersion !== user.tokenVersion) {
          return {
            response: NextResponse.json(
              errorResponse("Token revoked. Please re-login.", null, "TOKEN_REVOKED"),
              { status: 401 }
            ),
          };
        }
        // Seed the cache with the authoritative DB value (best effort).
        await setCachedTokenVersion(user.sub, dbUser.tokenVersion);
      }
    } catch {
      // DB failure — fail closed
      return {
        response: NextResponse.json(
          errorResponse("Authentication service unavailable", null, "UNAUTHORIZED"),
          { status: 401 }
        ),
      };
    }
  }

  // Phase 4: Check session not revoked (shared for all user types)
  try {
    const sessionStart = start();
    const session = await prisma.session.findUnique({
      where: { id: user.sessionId },
      select: { revokedAt: true },
    });
    log("auth_guard_session_lookup", elapsed(sessionStart));
    if (!session || session.revokedAt) {
      return {
        response: NextResponse.json(
          errorResponse("Session revoked. Please re-login.", null, "SESSION_REVOKED"),
          { status: 401 }
        ),
      };
    }
  } catch {
    // DB failure — fail closed
    return {
      response: NextResponse.json(
        errorResponse("Authentication service unavailable", null, "UNAUTHORIZED"),
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * requireRole: requireAuth + DB-driven role check.
 */
export async function requireRole(
  request: NextRequest,
  roles: string[]
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.response) return auth;

  let dbResult: boolean | typeof DB_FAILURE_SENTINEL = false;
  try {
    for (const role of roles) {
      if (await hasRole(auth.user.sub, role)) {
        dbResult = true;
        break;
      }
    }
  } catch {
    dbResult = DB_FAILURE_SENTINEL;
  }

  if (dbResult !== DB_FAILURE_SENTINEL) {
    if (dbResult === true) return auth;
    return {
      response: NextResponse.json(
        errorResponse("Forbidden: insufficient role", null, "FORBIDDEN"),
        { status: 403 }
      ),
    };
  }

  if (!RBAC_FALLBACK_ENABLED) {
    return {
      response: NextResponse.json(
        errorResponse("Forbidden: insufficient role", null, "FORBIDDEN"),
        { status: 403 }
      ),
    };
  }

  if (roles.includes(auth.user.role)) return auth;

  return {
    response: NextResponse.json(
      errorResponse("Forbidden: insufficient role", null, "FORBIDDEN"),
      { status: 403 }
    ),
  };
}

/**
 * requirePermission: requireAuth + DB-driven permission check.
 */
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (auth.response) return auth;

  const permissions = await resolveUserPermissions(auth.user.sub, auth.user.role);
  if (permissions.includes("*")) return auth;
  if (permissions.includes(permission)) return auth;

  return {
    response: NextResponse.json(
      errorResponse(
        "Forbidden: missing required permission",
        "FORBIDDEN",
        { required: permission, role: auth.user.role }
      ),
      { status: 403 }
    ),
  };
}

// ─── Cookie helpers ────────────────────────────────────────────

export function setAuthCookie(
  response: NextResponse,
  token: string,
  isSecure: boolean
): void {
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 60 minutes (matches access token expiry)
  });
}

export function setRefreshCookie(
  response: NextResponse,
  refreshToken: string,
  isSecure: boolean
): void {
  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export function clearAuthCookie(
  response: NextResponse,
  isSecure: boolean
): void {
  response.cookies.set("token", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function clearRefreshCookie(
  response: NextResponse,
  isSecure: boolean
): void {
  response.cookies.set("refresh_token", "", {
    httpOnly: true,
    secure: isSecure,
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 0,
  });
}

export function clearAllAuthCookies(
  response: NextResponse,
  isSecure: boolean
): void {
  clearAuthCookie(response, isSecure);
  clearRefreshCookie(response, isSecure);
}

export function isSecureRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto === "https") return true;
  return request.nextUrl.protocol === "https:";
}