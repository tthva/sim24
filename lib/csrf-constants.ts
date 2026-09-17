/**
 * Client-safe CSRF constants (double-submit cookie pattern).
 * MUST NOT import node:crypto so it can be bundled for the browser.
 */
export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_TTL_SECONDS = 60 * 60 * 8;
