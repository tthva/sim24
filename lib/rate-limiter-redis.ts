// ============================
// SIM24 — Redis-backed Rate Limiter
// ============================
// Sliding window rate limiter using Redis.
// FAIL-OPEN: If Redis is unavailable, rate limiting is SKIPPED and requests
// are allowed through. A warning is logged once. This ensures authentication
// never becomes completely unavailable due to a Redis outage.
// In production, Redis should always be running for rate limiting to work.
// ============================

import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisDownLogged = false;
// Track the last time a connect attempt failed so we don't hammer a dead
// Redis on every request (each attempt can cost up to the connect timeout).
let lastRedisDownAt = 0;
const REDIS_RETRY_COOLDOWN_MS = 15_000;

// Bounded connect timeout so auth never stalls on a dead Redis.
// Redis connect default is 5s which can cause multi-second login stalls.
const REDIS_CONNECT_TIMEOUT_MS = 1500;

async function getRedisClient(): Promise<RedisClientType | null> {
  // Only ever return a client that was successfully connected.
  // A stale/broken client must NOT be reused: commands on a dead client
  // block up to the socket connect timeout before failing, which stalls auth.
  if (redisClient && redisClient.isOpen) return redisClient;
  redisClient = null; // never cache a broken client

  const url = process.env.REDIS_URL;
  if (!url) return null;

  // After a recent failure, fail open immediately without blocking on a timeout.
  if (Date.now() - lastRedisDownAt < REDIS_RETRY_COOLDOWN_MS) {
    return null;
  }

  let candidate: RedisClientType | null = null;
  try {
    candidate = createClient({
      url,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        // Do NOT auto-reconnect: a dead Redis must fail fast so auth never
        // stalls. Requiring connect() to reject quickly also avoids the
        // node-redis behavior where an attached error listener makes
        // connect() hang waiting for a reconnect that never succeeds.
        reconnectStrategy: false,
      },
    });
    // Prevent an unhandled 'error' crash on later reconnect attempts.
    candidate.on("error", () => {
      /* handled by reconnect / next getRedisClient check */
    });
    await candidate.connect();
    redisClient = candidate; // cache only after successful connect
    redisDownLogged = false;
    lastRedisDownAt = 0;
    return redisClient;
  } catch {
    if (candidate) {
      try {
        candidate.destroy();
      } catch {
        // ignore cleanup failure
      }
    }
    redisClient = null;
    lastRedisDownAt = Date.now();
    if (!redisDownLogged) {
      console.warn("[RATE-LIMIT] WARNING: Redis unavailable. Rate limiting is FAIL-OPEN (requests allowed).");
      redisDownLogged = true;
    }
    return null;
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number };

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

// ─── Fail-open: allow requests when Redis is down ────────────────

function failOpen(): RateLimitResult {
  return { allowed: true, remaining: 0, resetAt: Date.now() + 60_000 };
}

// ─── Redis sliding window ──────────────────────────────────────

async function checkRedis(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const client = await getRedisClient();
  if (!client) {
    // FAIL-OPEN: Redis unavailable → allow the request, rate limit is skipped
    return failOpen();
  }

  const fullKey = `${options.keyPrefix ?? "rl"}:${key}`;
  const now = Date.now();
  const windowStart = now - options.windowMs;

  try {
    // Remove old entries outside the window
    await client.zRemRangeByScore(fullKey, 0, windowStart);
    // Count entries in current window
    const count = await client.zCard(fullKey);
    // Add current request
    await client.zAdd(fullKey, { score: now, value: `${now}-${Math.random()}` });
    // Set TTL on the key
    await client.expire(fullKey, Math.ceil(options.windowMs / 1000));

    const resetAt = now + options.windowMs;
    if (count >= options.max) {
      return { allowed: false, remaining: 0, resetAt };
    }
    return { allowed: true, remaining: options.max - count - 1, resetAt };
  } catch {
    // Redis operation failure — fail-open (allow request, log warning)
    if (!redisDownLogged) {
      console.warn("[RATE-LIMIT] WARNING: Redis operation failed. Rate limiting is FAIL-OPEN (requests allowed).");
      redisDownLogged = true;
    }
    return failOpen();
  }
}

// ─── Public API ────────────────────────────────────────────────

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  return checkRedis(key, options);
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

// ─── Cleanup ───────────────────────────────────────────────────

export async function shutdownRateLimiter(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      // ignore
    }
    redisClient = null;
  }
}