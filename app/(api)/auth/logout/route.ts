// ============================
// SIM24 — Logout Endpoint
// ============================
// POST /api/auth/logout
// Revokes the current session only (per-device logout).
// Does NOT increment tokenVersion — other sessions remain valid.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { clearAllAuthCookies, isSecureRequest } from "@/lib/auth-guard";
import { errorResponse } from "@/lib/types/api";
import { clearCsrfCookie } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  try {
    const secure = isSecureRequest(request);
    const response = NextResponse.json({ success: true });

    // Read access token to identify the session
    const token = request.cookies.get("token")?.value;
    if (token) {
      try {
        const payload = await verifyToken(token);
        const sessionId = payload.sessionId;
        const userId = payload.sub;

        // Revoke this session only
        await prisma.$transaction([
          prisma.session.update({
            where: { id: sessionId },
            data: { revokedAt: new Date() },
          }),
          prisma.refreshToken.updateMany({
            where: { sessionId, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]);
      } catch {
        // Token invalid — still clear cookies
      }
    }

    // Clear both cookies with exact path/scope match
    clearAllAuthCookies(response, secure);

    // Prevent caching of authenticated pages
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;
  } catch (error) {
    console.error("[Logout] Error:", error);
    // Even on error, try to clear cookies
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