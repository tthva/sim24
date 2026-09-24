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
