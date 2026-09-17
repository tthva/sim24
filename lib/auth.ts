// lib/auth.ts — Unified Client-Side Auth Helpers
// Phase 4: Added refreshToken() for automatic silent refresh.

const AUTH_COOKIE_NAME = "token";

/**
 * Get the raw JWT token from cookies.
 * Works in client context only (document.cookie).
 * Server-side reads happen in middleware/API routes via next/headers.
 */
export function getToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Check if user is currently authenticated by calling our validation endpoint.
 * Phase 4: This now validates tokenVersion + session status server-side.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/check", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Attempt to refresh the access token using the refresh_token cookie.
 * This is called automatically when the access token expires.
 * 
 * Phase 4: The browser automatically sends the refresh_token cookie
 * (path-restricted to /api/auth/refresh) when this is called.
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Log out: call the server to revoke the session and clear cookies.
 * Phase 4: This revokes the current session (not all devices).
 */
export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/login";
}

/**
 * Log out from ALL devices: calls server to invalidate all sessions.
 * Phase 4: Increments tokenVersion globally.
 */
export async function logoutAll(): Promise<void> {
  await fetch("/api/auth/logout-all", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/login";
}

/**
 * Check if the current device is authenticated and return user info.
 */
export async function getCurrentUserInfo(): Promise<{
  authenticated: boolean;
  role?: string;
  id?: string;
  sessionId?: string;
}> {
  try {
    const res = await fetch("/api/auth/check", { credentials: "include" });
    if (!res.ok) return { authenticated: false };
    const data = await res.json();
    return {
      authenticated: true,
      role: data.role,
      id: data.id,
      sessionId: data.sessionId,
    };
  } catch {
    return { authenticated: false };
  }
}