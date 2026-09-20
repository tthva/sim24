// ─────────────────────────────────────────────
// CRM — Sequential customer-code generator
// Format: "C-" + 6-digit zero-padded number  →  C-000001
// Primary counter: Redis INCR (fast, atomic).
// Fallback (no Redis): DB count + collision retry.
// ─────────────────────────────────────────────

import { prisma } from "@/lib/prisma";

const REDIS_KEY = "crm:customer_code_seq";

function pad6(n: number): string {
  return String(n).padStart(6, "0");
}

async function nextFromRedis(): Promise<number | null> {
  try {
    const { createClient } = await import("redis");
    const url = process.env.REDIS_URL;
    if (!url) return null;
    const client = createClient({
      url,
      socket: { connectTimeout: 1500, reconnectStrategy: false },
    });
    client.on("error", () => {});
    await client.connect();
    try {
      const current = await client.get(REDIS_KEY);
      if (current === null) {
        // Seed the counter from the DB so existing customers keep their codes
        const count = await prisma.customer.count();
        const seed = count + 1;
        await client.set(REDIS_KEY, String(seed));
        return seed;
      }
      return await client.incr(REDIS_KEY);
    } finally {
      await client.quit().catch(() => {});
    }
  } catch {
    return null; // Redis unavailable → DB fallback
  }
}

/**
 * Generate the next unique customer code.
 * Tries Redis INCR first; falls back to count-based generation with
 * collision retry (guaranteed unique because customerCode is @unique).
 */
export async function generateCustomerCode(): Promise<string> {
  const redisNext = await nextFromRedis();
  if (redisNext !== null) {
    return `C-${pad6(redisNext)}`;
  }

  // DB fallback
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.customer.count();
    const candidate = `C-${pad6(count + 1 + attempt)}`;
    const exists = await prisma.customer.findUnique({
      where: { customerCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Extremely unlikely: absolute fallback on timestamp
  return `C-${pad6(Date.now() % 1000000)}`;
}
