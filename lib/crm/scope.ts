// ============================
// CRM — Data-scope helpers (Phase 4.8b-2)
// Per-owner filtering for CRM list endpoints.
// Users with crm.view_all (or the admin "*" wildcard) see everything;
// everyone else sees only rows they own.
// Fail-closed: if the permission or ownership lookup fails, the user is
// treated as NOT having view_all / having no owner id.
// ============================

import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

/**
 * Whether the user may see all CRM rows (bypasses ownership filters).
 * Fail-closed: any error => false (scoped down).
 */
export async function hasViewAllPermission(userId: string): Promise<boolean> {
  try {
    const perms = await getUserPermissions(userId);
    return perms.includes("*") || perms.includes("crm.view_all");
  } catch {
    return false; // fail-closed: no view_all
  }
}

/**
 * Resolve the user's Agent profile id — the owner key used by
 * Customer.referralAgentId (crm customers are "owned" via referral agent).
 * Fail-closed: any error / missing profile => null (caller must return empty).
 */
export async function getUserAgentId(userId: string): Promise<string | null> {
  try {
    const agent = await prisma.agent.findUnique({
      where: { userId },
      select: { id: true },
    });
    return agent?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Owner-scope branches for Customer rows (Phase 4.8c hardening, decision D1).
 *
 * Without crm.view_all a user may read:
 *   • customers they own (referralAgentId = their Agent.id), and
 *   • OWNERLESS customers (referralAgentId IS NULL) — e.g. the 150 legacy
 *     form backfills that were never referred by an agent. Before D1 these
 *     were invisible to every non-view_all user.
 *
 * Returns OR-branches for a Prisma.CustomerWhereInput. Callers must NOT put
 * these in `where.OR` alongside another OR group (e.g. a search filter) —
 * the second assignment would win. Combine the groups with `AND` instead:
 *
 *   where.AND = [{ OR: await getCustomerScopeBranches(userId) }, { OR: […search] }]
 */
export async function getCustomerScopeBranches(
  userId: string
): Promise<Prisma.CustomerWhereInput[]> {
  const agentId = await getUserAgentId(userId);
  const branches: Prisma.CustomerWhereInput[] = [{ referralAgentId: null }];
  if (agentId) branches.push({ referralAgentId: agentId });
  return branches;
}

/**
 * Single-row counterpart of getCustomerScopeBranches (decision D1).
 *
 * Ownerless customers (referralAgentId IS NULL) are readable by any user
 * with crm.read; owned customers only by their owning agent. Callers should
 * still short-circuit on hasViewAllPermission BEFORE calling this.
 */
export async function canViewCustomer(
  userId: string,
  referralAgentId: string | null
): Promise<boolean> {
  if (referralAgentId === null) return true; // ownerless → any crm.read user
  const agentId = await getUserAgentId(userId);
  return agentId !== null && agentId === referralAgentId;
}
