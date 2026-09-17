// ============================
// SIM24 — Logout-All Endpoint
// ============================
// POST /api/auth/logout-all
// Increments User.tokenVersion (global invalidation) + revokes ALL sessions
// and ALL refresh tokens for the authenticated user.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { clearAllAuthCookies, isSecureRequest, requireAuth } from "@/lib/auth-guard";
import { errorResponse } from "@/lib/types/api";
import { invalidateTokenVersionCache } from "@/lib/auth-cache";
import { clearCsrfCookie } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  try {
    const secure = isSecureRequest(request);

    // Require valid authentication
    const auth = await requireAuth(request);
    if (auth.response) {
      // Even if auth fails, clear cookies
      const resp = NextResponse.json(
        errorResponse("Authentication required", null, "UNAUTHORIZED"),
        { status: 401 }
      );
      clearAllAuthCookies(resp, secure);
      return resp;
    }

    const userId = auth.user.sub;

    // Global invalidation: increment tokenVersion + revoke all sessions + tokens
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
        ]);

    // Invalidate the cached tokenVersion so middleware picks up the bump on
    // the next request (within one cache TTL, ~60s) instead of relying on
    // JWT expiry. Fail-open: cache write errors are non-fatal.
    invalidateTokenVersionCache(userId).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: "All sessions revoked. Please re-login.",
    });

    clearAllAuthCookies(response, secure);

    return response;
  } catch (error) {
    console.error("[LogoutAll] Error:", error);
    const secure = isSecureRequest(request);
    const response = NextResponse.json(
      errorResponse("Internal server error", null, "INTERNAL_ERROR"),
      { status: 500 }
    );
    clearAllAuthCookies(response, secure);
  clearCsrfCookie(response);
    return response;
  }
}