// ============================
// SIM24 — Search Result Cache (Redis L2)
// ============================
// Caches search results with normalized keys.
// Supports coarse invalidation by formType prefix.
// TTL: 60-180s depending on endpoint.
// ============================

import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let lastRedisDownAt = 0;
const REDIS_RETRY_COOLDOWN_MS = 15_000;
const REDIS_CONNECT_TIMEOUT_MS = 1500;

async function getRedis(): Promise<RedisClientType | null> {
  // Only return a successfully connected client. A broken cached client
  // causes commands to block up to the socket timeout, stalling requests.
  if (redisClient && redisClient.isOpen) return redisClient;
  redisClient = null;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (Date.now() - lastRedisDownAt < REDIS_RETRY_COOLDOWN_MS) return null;

  let candidate: RedisClientType | null = null;
  try {
    candidate = createClient({
      url,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy: false,
      },
    });
    candidate.on("error", () => {
      /* handled by reconnect / next getRedis check */
    });
    await candidate.connect();
    redisClient = candidate;
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
    return null;
  }
}

function normalizeKey(prefix: string, params: Record<string, any>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return `search:${prefix}:${sorted}`;
}

/**
 * Get cached search results.
 */
export async function getCachedSearch<T>(
  prefix: string,
  params: Record<string, any>
): Promise<{ data: T; cached: boolean } | null> {
  const client = await getRedis();
  if (!client) return null;

  const key = normalizeKey(prefix, params);
  try {
    const cached = await client.get(key);
    if (cached) {
      return { data: JSON.parse(cached), cached: true };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set cached search results with TTL.
 */
export async function setCachedSearch<T>(
  prefix: string,
  params: Record<string, any>,
  data: T,
  ttlSeconds: number = 120
): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  const key = normalizeKey(prefix, params);
  try {
    await client.set(key, JSON.stringify(data), { EX: ttlSeconds });
  } catch {
    // cache write failure is non-critical
  }
}

/**
 * Invalidate all search cache entries for a given prefix.
 * Uses Redis SCAN for coarse invalidation.
 */
export async function invalidateSearchCache(prefix: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  const pattern = `search:${prefix}:*`;
  try {
    let cursor = "0";
    do {
      const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;
      const keys = result.keys;
      if (keys.length > 0) {
        await client.del(keys);
      }
    } while (cursor !== "0");
  } catch {
    // invalidation failure is non-critical
  }
}

/**
 * Coarse invalidation — called when any form is created/updated/sold.
 */
export async function invalidateAllSearchCaches(): Promise<void> {
  await invalidateSearchCache("forms");
  await invalidateSearchCache("sim");
}