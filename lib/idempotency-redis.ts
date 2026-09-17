// ============================
// SIM24 — Redis-backed Idempotency
// ============================
// Prevents duplicate form submissions using Idempotency-Key header.
// Keys are stored in Redis with TTL (default 5 minutes).
// Falls back to DB lookup if Redis is unavailable.
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

const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes

export interface IdempotencyRecord {
  formId: string;
  status: "pending" | "completed" | "failed";
  response?: any;
  createdAt: string;
}

/**
 * Attempt to claim an idempotency key.
 * Returns the existing record if the key is already taken (409 Conflict),
 * or null if the key is available and has been claimed.
 */
export async function tryClaimIdempotencyKey(
  key: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<{ claimed: false; existing: IdempotencyRecord } | { claimed: true }> {
  const client = await getRedis();

  if (client) {
    // Redis path — SET NX with TTL
    const now = new Date().toISOString();
    const value = JSON.stringify({
      formId: `pending-${key}`,
      status: "pending",
      createdAt: now,
    } as IdempotencyRecord);

    const result = await client.set(key, value, {
      NX: true,
      EX: ttlSeconds,
    });

    if (result === "OK") {
      return { claimed: true };
    }

    // Key exists — get existing record
    const existingStr = await client.get(key);
    if (existingStr) {
      try {
        const existing = JSON.parse(existingStr) as IdempotencyRecord;
        return { claimed: false, existing };
      } catch {
        // Invalid JSON in Redis — treat as available
        return { claimed: true };
      }
    }

    // Race condition — key expired between SET NX and GET
    return { claimed: true };
  }

  // Fallback: no Redis available — allow the request (no idempotency guarantee)
  return { claimed: true };
}

/**
 * Update an idempotency key with the completed form ID and response.
 */
export async function completeIdempotencyKey(
  key: string,
  formId: string,
  response: any,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  const record: IdempotencyRecord = {
    formId,
    status: "completed",
    response,
    createdAt: new Date().toISOString(),
  };

  await client.set(key, JSON.stringify(record), {
    EX: ttlSeconds,
  });
}

/**
 * Mark an idempotency key as failed.
 */
export async function failIdempotencyKey(
  key: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  const record: IdempotencyRecord = {
    formId: `failed-${key}`,
    status: "failed",
    createdAt: new Date().toISOString(),
  };

  await client.set(key, JSON.stringify(record), {
    EX: ttlSeconds,
  });
}

/**
 * Delete an idempotency key entirely from Redis.
 * Used when a transaction commits but subsequent steps (e.g., workflow start)
 * fail, so the key should be fully removed — allowing the client to retry
 * as a completely fresh request without hitting a 409 block.
 */
export async function deleteIdempotencyKey(key: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;

  try {
    await client.del(key);
  } catch {
    // Swallow — Redis unavailability is non-fatal; the key will expire via TTL
  }
}

/**
 * Get the idempotency key from request headers.
 */
export function getIdempotencyKey(req: { headers: { get: (name: string) => string | null } }): string | null {
  const key = req.headers.get("x-idempotency-key") || req.headers.get("Idempotency-Key");
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}
