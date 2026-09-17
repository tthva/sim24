import { createClient, RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisDownLogged = false;
let lastRedisDownAt = 0;
const REDIS_RETRY_COOLDOWN_MS = 15_000;
const REDIS_CONNECT_TIMEOUT_MS = 1500;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient && redisClient.isOpen) return redisClient;
  redisClient = null;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (Date.now() - lastRedisDownAt < REDIS_RETRY_COOLDOWN_MS) {
    return null;
  }

  let candidate: RedisClientType | null = null;
  try {
    candidate = createClient({
      url,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy: false,
      },
    });
    candidate.on("error", () => {});
    await candidate.connect();
    redisClient = candidate;
    redisDownLogged = false;
    lastRedisDownAt = 0;
    return redisClient;
  } catch {
    if (candidate) {
      try { candidate.destroy(); } catch {}
    }
    redisClient = null;
    lastRedisDownAt = Date.now();
    if (!redisDownLogged) {
      console.warn("[AUTH-CACHE] WARNING: Redis unavailable. tokenVersion cache is FAIL-OPEN (JWT-only validation).");
      redisDownLogged = true;
    }
    return null;
  }
}

const TV_TTL_SECONDS = 60;

export async function getCachedTokenVersion(userId: string): Promise<number | null> {
  const r = await getRedisClient();
  if (!r) return null;
  try {
    const val = await r.get(`auth:tv:${userId}`);
    return val ? Number(val) : null;
  } catch {
    return null;
  }
}

export async function setCachedTokenVersion(userId: string, version: number): Promise<void> {
  const r = await getRedisClient();
  if (!r) return;
  try {
        await r.setEx(`auth:tv:${userId}`, TV_TTL_SECONDS, String(version));
  } catch {}
}

export async function invalidateTokenVersionCache(userId: string): Promise<void> {
  const r = await getRedisClient();
  if (!r) return;
  try {
    await r.del(`auth:tv:${userId}`);
  } catch {}
}

