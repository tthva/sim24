import { PrismaClient } from "@prisma/client";

// ─── Connection pooling (Phase 2 — 100 concurrent users) ───
// Adds connection_limit to DATABASE_URL without touching the env file.
// 2 PM2 cluster workers × 20 = max 40 connections (Postgres default max=100).
function pooledDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.includes("connection_limit=")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=20&pool_timeout=10`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: pooledDatabaseUrl() } },
  });

// Singleton in ALL environments (not just dev) — cluster workers must reuse
// a single pool per process instead of opening a pool per module instance.
globalForPrisma.prisma = prisma;

