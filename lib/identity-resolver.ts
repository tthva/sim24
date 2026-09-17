// ============================
// SIM24 — Identity Resolvers
// ============================
// Maps auth subject (`User.id`) to domain entity IDs.
// 
// Rule: `auth.user.sub` is ALWAYS `User.id`.
// To access domain-specific tables, resolve through these helpers.
// ============================

import { prisma } from "@/lib/prisma";

/**
 * Resolve User.id → Agent.id
 * Returns Agent.id if user has an active agent profile, otherwise null.
 */
export async function resolveAgentId(userId: string): Promise<string | null> {
  const agent = await prisma.agent.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  return agent?.id ?? null;
}

/**
 * Resolve User.id → Admin.id
 * Returns Admin.id if user has an admin profile, otherwise null.
 */
export async function resolveAdminId(userId: string): Promise<string | null> {
  const admin = await prisma.admin.findFirst({
    where: { userId },
    select: { id: true },
  });
  return admin?.id ?? null;
}
