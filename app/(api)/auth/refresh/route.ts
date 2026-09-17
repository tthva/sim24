// ============================
// SIM24 — Refresh Token Endpoint
// ============================
// POST /api/auth/refresh
// Reads the refresh_token cookie, validates it, rotates it (transactional),
// and issues a new access token + new refresh token.
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, hashRefreshToken, generateRefreshToken } from "@/lib/jwt";
import { setAuthCookie, setRefreshCookie, clearAllAuthCookies, isSecureRequest } from "@/lib/auth-guard";
import { errorResponse } from "@/lib/types/api";
import { randomUUID } from "crypto";
import { start, elapsed, log } from "@/lib/auth-perf";
import { invalidateTokenVersionCache } from "@/lib/auth-cache";

export async function POST(request: NextRequest) {
  const t0 = start();
  try {
    const secure = isSecureRequest(request);

    // Read refresh token from cookie (path-restricted)
    const rawRefreshToken = request.cookies.get("refresh_token")?.value;
    if (!rawRefreshToken) {
      log("refresh_total", elapsed(t0), { outcome: "missing_token" });
      return NextResponse.json(
        errorResponse("Refresh token missing", null, "REFRESH_MISSING"),
        { status: 401 }
      );
    }

    const tokenHash = hashRefreshToken(rawRefreshToken);
    const tokenLookupStart = start();
    const storedToken = await prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: {
        session: true,
        user: { select: { id: true, username: true, userType: true, tokenVersion: true, active: true, agentProfile: { select: { department: true } }, adminProfile: { select: { department: true } } } },
        endUser: { select: { id: true, username: true, active: true } },
      },
    });
    log("refresh_token_lookup", elapsed(tokenLookupStart));

    // Validation checks
    if (!storedToken) {
      return NextResponse.json(
        errorResponse("Invalid refresh token", null, "REFRESH_INVALID"),
        { status: 401 }
      );
    }

    if (storedToken.consumedAt) {
      // 30-second grace window: real multi-tab / mobile-latency scenarios
      // routinely exceed 5 s and produce false-positive theft detections.
      const GRACE_WINDOW_MS = 30000;
      const consumedRecently =
        Date.now() - new Date(storedToken.consumedAt).getTime() < GRACE_WINDOW_MS;
      if (consumedRecently) {
        // fall through to normal rotation below — same family, new token
      } else {
        // TOKEN STOLEN — replay detection (reuse outside the grace window)
        console.warn(`[AUTH] Refresh token reuse detected! userId=${storedToken.userId}, endUserId=${storedToken.endUserId}, family=${storedToken.family}. Revoking all tokens in family.`);
        await prisma.$transaction([
          prisma.refreshToken.updateMany({
            where: { family: storedToken.family },
            data: { revokedAt: new Date() },
          }),
          prisma.session.update({
            where: { id: storedToken.sessionId },
            data: { revokedAt: new Date() },
          }),
          // Only update User tokenVersion if this is a User token (not EndUser)
          ...(storedToken.userId ? [
            prisma.user.update({
              where: { id: storedToken.userId },
              data: { tokenVersion: { increment: 1 } },
            })
          ] : []),
                ]);

        // Invalidate cached tokenVersion so middleware redirects stale JWTs
        // to login immediately (cache TTL ~60s). Fail-open on cache errors.
        if (storedToken.userId) {
          invalidateTokenVersionCache(storedToken.userId).catch(() => {});
        }

        const response = NextResponse.json(
          errorResponse("Token compromised. All sessions revoked.", null, "TOKEN_STOLEN"),
          { status: 401 }
        );
        clearAllAuthCookies(response, secure);
        return response;
      }
    }

    if (storedToken.revokedAt) {
      return NextResponse.json(
        errorResponse("Refresh token revoked", null, "REFRESH_REVOKED"),
        { status: 401 }
      );
    }

    if (storedToken.expiresAt < new Date()) {
      return NextResponse.json(
        errorResponse("Refresh token expired", null, "REFRESH_EXPIRED"),
        { status: 401 }
      );
    }

    if (storedToken.session.revokedAt) {
      return NextResponse.json(
        errorResponse("Session revoked", null, "SESSION_REVOKED"),
        { status: 401 }
      );
    }

    const user = storedToken.user;
    const endUser = storedToken.endUser;
    
    // For EndUser tokens, check endUser.active; for User tokens, check user.active
    const isActive = endUser ? endUser.active : (user?.active ?? false);
    const account = endUser || user;
    
    if (!account || !isActive) {
      return NextResponse.json(
        errorResponse("Account inactive", null, "UNAUTHORIZED"),
        { status: 401 }
      );
    }

    // Phase 4: Check tokenVersion — only for User tokens (EndUsers don't have tokenVersion)
    if (user && storedToken.user && user.tokenVersion > (storedToken.user.tokenVersion ?? 0)) {
      return NextResponse.json(
        errorResponse("All sessions revoked. Please re-login.", null, "TOKEN_REVOKED"),
        { status: 401 }
      );
    }

    // Transactional rotation
    const newRefreshFamily = storedToken.family; // same family
    const newSessionId = storedToken.sessionId;
    const { rawToken: newRawToken, hash: newHash } = generateRefreshToken();

    const txStart = start();
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Mark old token as consumed
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { consumedAt: now },
      });
      // Insert new refresh token
      const newToken = await tx.refreshToken.create({
        data: {
          tokenHash: newHash,
          userId: storedToken.userId,
          endUserId: storedToken.endUserId,
          sessionId: newSessionId,
          family: newRefreshFamily,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      // Update session lastUsedAt
      await tx.session.update({
        where: { id: newSessionId },
        data: { lastUsedAt: now },
      });
      // Revoke older CONSUMED siblings in the same session (orphan cleanup).
      // These tokens are already superseded by the one just issued; revoking
      // them limits the blast radius if a stale cookie is replayed later.
      // (Only consumed siblings are touched — an unconsumed sibling may still
      // be in flight for another tab, and revoking it would break that tab.)
      await tx.refreshToken.updateMany({
        where: {
          sessionId: newSessionId,
          consumedAt: { not: null },
          id: { not: newToken.id },
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
    });
    log("refresh_transaction", elapsed(txStart));

    // Determine role and user info based on token type
    let role: "admin" | "operator" | "agent" | "user" = "user";
    let username: string = "";
    let userId: string = "";
    let userType: "ADMIN" | "AGENT" = "AGENT";
    let departmentId: string | null = null;
    let tokenVersion: number = 0;

    if (endUser) {
      // EndUser token
      role = "user";
      username = endUser.username;
      userId = endUser.id;
      userType = "AGENT";
    } else if (user) {
      // Regular User token
      const roleAssignment = await prisma.userRoleAssignment.findFirst({
        where: { userId: user.id },
        include: { role: true },
      });
      role = (roleAssignment?.role?.code?.toLowerCase() as "admin" | "operator" | "agent" | "user") ?? "user";
      username = user.username;
      userId = user.id;
      userType = user.userType;
      departmentId = user.userType === "ADMIN"
        ? user.adminProfile?.department ?? null
        : user.agentProfile?.department ?? null;
      tokenVersion = user.tokenVersion;
    }

    const jwtStart = start();
    const newAccessToken = await signToken({
      sub: userId,
      role,
      username,
      userType,
      departmentId,
      tokenVersion,
      sessionId: newSessionId,
    });
    log("refresh_jwt_sign", elapsed(jwtStart));

    const response = NextResponse.json({ success: true });
    setAuthCookie(response, newAccessToken, secure);
    setRefreshCookie(response, newRawToken, secure);
    log("refresh_total", elapsed(t0), { outcome: "success" });
    return response;
  } catch (error) {
    console.error("[Refresh] Error:", error);
    return NextResponse.json(
      errorResponse("Internal server error", null, "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}