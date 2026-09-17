import { SignJWT, jwtVerify } from "jose";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export type JwtRole = "admin" | "agent" | "operator" | "user";

/**
 * Phase 4 JWT Payload.
 * Minimal claims for auth + middleware compatibility.
 * Authorization authority remains in DB (Phase 3 RBAC).
 */
export type JwtPayload = {
  /** User.id (UUID) — canonical identity */
  sub: string;
  /** For middleware UI routing + RBAC fallback */
  role: JwtRole;
  /** For getLandingPage() routing (middleware) */
  username: string;
  /** For middleware routing */
  userType: "ADMIN" | "AGENT";
  /** For middleware routing */
  departmentId?: string | null;
  /** From User.tokenVersion — enables server-side revocation */
  tokenVersion: number;
  /** UUID — identifies this specific session for per-device logout */
  sessionId: string;
  /** Issued at (epoch) */
  iat?: number;
  /** Expires at (epoch) */
  exp?: number;
};

export async function signToken(payload: {
  sub: string;
  role: JwtRole;
  username: string;
  userType: "ADMIN" | "AGENT";
  departmentId?: string | null;
  tokenVersion: number;
  sessionId: string;
}): Promise<string> {
  const jwtPayload: Record<string, unknown> = {
    sub: payload.sub,
    role: payload.role,
    username: payload.username,
    userType: payload.userType,
    tokenVersion: payload.tokenVersion,
    sessionId: payload.sessionId,
  };

  // Only include departmentId if non-null
  if (payload.departmentId != null) {
    jwtPayload.departmentId = payload.departmentId;
  }

  return new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60m") // 60-minute access token (was 15m — caused random logouts)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as JwtPayload;
}

// ─── Refresh Token Utilities ─────────────────────────────────

import { randomUUID } from "crypto";
import { createHash } from "crypto";

/**
 * Generate a random opaque refresh token.
 * Returns { rawToken: string, hash: string }.
 * The raw token is sent to the client. Only the hash is stored in DB.
 */
export function generateRefreshToken(): {
  rawToken: string;
  hash: string;
} {
  const rawToken = randomUUID() + "-" + randomUUID();
  const hash = createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, hash };
}

/**
 * Hash a refresh token for lookup (without storing the raw token).
 */
export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}