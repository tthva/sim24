// ============================
// SIM24 — Rate Limiter
// ============================
// Simple in-memory rate limiter for auth endpoints.
// For production behind multiple instances, replace with Redis-backed store.
// ============================

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number };

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const prefix = options.keyPrefix ?? "rl";
  const fullKey = `${prefix}:${key}`;
  const now = Date.now();
  const entry = store.get(fullKey);
  let resetAt: number;

  if (!entry || now > entry.resetAt) {
    resetAt = now + options.windowMs;
    store.set(fullKey, { count: 1, resetAt });
    return { allowed: true, remaining: options.max - 1, resetAt };
  }

  resetAt = entry.resetAt;
  if (entry.count >= options.max) {
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: options.max - entry.count, resetAt };
}

export function getRateLimitHeaders(options: RateLimitOptions, result: RateLimitResult) {
  const remaining = result.allowed ? result.remaining : 0;
  const resetAt = result.resetAt;
  return {
    "X-RateLimit-Limit": String(options.max),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}