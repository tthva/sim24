// ============================
// SIM24 — RBAC Service Layer
// ============================
// Database-driven Role-Based Access Control.
// Replaces the hardcoded rolePermissions map in lib/auth-guard.ts.
// ============================

import { prisma } from "@/lib/prisma";

// ─── Types ─────────────────────────────────────────────────────

export type RoleInfo = {
  id: string;
  code: string;
  title: string;
};

export type PermissionInfo = {
  id: string;
  code: string;
  name: string;
  group: string;
};

// ─── Short-lived in-process TTL cache ─────────────────────────
// Uses a module-level Map with 5-second TTL to avoid repeated DB queries
// within the same request. In Next.js App Router (serverless), each request
// typically gets a fresh module instance, but this is NOT a guarantee.
// 
// If strict request scoping is required, refactor to AsyncLocalStorage
// or Next.js `unstable_cache` (available in Next.js 16).
// 
// Cache is cleared on any RBAC mutation (assignRole / removeRole).
// For production with high throughput, consider Redis-based caching.

const requestCache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string): T | null {
  const entry = requestCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    requestCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs = 5000): void {
  requestCache.set(key, { data, expiry: Date.now() + ttlMs });
}

function clearCache(): void {
  requestCache.clear();
}

// ─── Core Functions ────────────────────────────────────────────

/**
 * Get all roles assigned to a user.
 */
export async function getUserRoles(userId: string): Promise<RoleInfo[]> {
  const cacheKey = `roles:${userId}`;
  const cached = getCached<RoleInfo[]>(cacheKey);
  if (cached) return cached;

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    include: { role: true },
  });

  const roles = assignments.map((a) => ({
    id: a.role.id,
    code: a.role.code,
    title: a.role.title,
  }));

  setCache(cacheKey, roles);
  return roles;
}

/**
 * Get all permissions for a user, aggregated from all their roles.
 * Returns an array of permission code strings (e.g. ["workflow.read", "workflow.complete"]).
 * If any role has the wildcard permission "*", returns ["*"].
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const cacheKey = `perms:${userId}`;
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;

  const assignments = await prisma.userRoleAssignment.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const permissionSet = new Set<string>();

  for (const assignment of assignments) {
    for (const rp of assignment.role.permissions) {
      if (rp.permission.code === "*") {
        // Wildcard: user has all permissions
        setCache(cacheKey, ["*"]);
        return ["*"];
      }
      permissionSet.add(rp.permission.code);
    }
  }

  const permissions = Array.from(permissionSet);
  setCache(cacheKey, permissions);
  return permissions;
}

/**
 * Check if a user has a specific role.
 */
export async function hasRole(userId: string, roleCode: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some((r) => r.code === roleCode);
}

/**
 * Check if a user has a specific permission.
 * Supports wildcard: if user has "*" permission, returns true for any permission.
 */
export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (permissions.includes("*")) return true;
  return permissions.includes(permissionCode);
}

/**
 * Get all available permissions from the database (for seeding/admin UI).
 */
export async function getAllPermissions(): Promise<PermissionInfo[]> {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ group: "asc" }, { code: "asc" }],
  });

  return permissions.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    group: p.group,
  }));
}

/**
 * Get all roles from the database (for seeding/admin UI).
 */
export async function getAllRoles(): Promise<RoleInfo[]> {
  const roles = await prisma.role.findMany({
    orderBy: { code: "asc" },
  });

  return roles.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
  }));
}

/**
 * Assign a role to a user.
 */
export async function assignRole(userId: string, roleCode: string): Promise<void> {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new Error(`Role "${roleCode}" not found`);

  await prisma.userRoleAssignment.upsert({
    where: {
      userId_roleId: { userId, roleId: role.id },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
    },
  });

  // Invalidate cache
  clearCache();
}

/**
 * Remove a role from a user.
 */
export async function removeRole(userId: string, roleCode: string): Promise<void> {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new Error(`Role "${roleCode}" not found`);

  await prisma.userRoleAssignment.deleteMany({
    where: { userId, roleId: role.id },
  });

  // Invalidate cache
  clearCache();
}

// ─── Permission Matrix (for documentation/seed reference) ──────

export const PERMISSION_MATRIX: Record<string, string[]> = {
  admin: ["*"],
  operator: [
    "workflow.create",
    "workflow.read",
    "workflow.complete",
    "workflow.reassign",
    "workflow.timeline",
    "customerform.read",
    "customerform.assign",
  ],
  agent: [
    "customerform.read",
    "customerform.create",
  ],
  user: [
    "customerform.create",
  ],
};

/**
 * Seed default roles and permissions into the database.
 * Safe to call multiple times (uses upsert).
 */
export async function seedDefaultRBAC(): Promise<void> {
  // Create permissions
  const allPermissionCodes = new Set<string>();
  for (const perms of Object.values(PERMISSION_MATRIX)) {
    for (const p of perms) {
      allPermissionCodes.add(p);
    }
  }

  // Define permission metadata
  const permissionDefinitions: Array<{ code: string; name: string; group: string; description?: string }> = [
    { code: "*", name: "All Permissions", group: "system", description: "Wildcard — grants every permission" },
    { code: "workflow.create", name: "Create Workflow", group: "workflow", description: "Start a new workflow instance" },
    { code: "workflow.read", name: "Read Workflow", group: "workflow", description: "View workflow instance details" },
    { code: "workflow.complete", name: "Complete Step", group: "workflow", description: "Complete a workflow step" },
    { code: "workflow.reassign", name: "Reassign Step", group: "workflow", description: "Reassign a step to another user" },
    { code: "workflow.timeline", name: "View Timeline", group: "workflow", description: "View workflow step history" },
    { code: "customerform.read", name: "Read Forms", group: "customerform", description: "View customer form submissions" },
    { code: "customerform.create", name: "Create Form", group: "customerform", description: "Submit a customer form" },
    { code: "customerform.assign", name: "Assign Form", group: "customerform", description: "Assign a form to an agent" },
    { code: "admin.manage", name: "Admin Manage", group: "admin", description: "Manage system settings and users" },
  ];

  for (const def of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { code: def.code },
      update: { name: def.name, group: def.group, description: def.description },
      create: { code: def.code, name: def.name, group: def.group, description: def.description },
    });
  }

  // Create roles
  const roleDefinitions = [
    { code: "admin", title: "مدیر سیستم", description: "Full system access", isSystem: true },
    { code: "operator", title: "اپراتور", description: "Workflow operator", isSystem: true },
    { code: "agent", title: "نماینده", description: "Sales agent", isSystem: true },
    { code: "user", title: "کاربر عادی", description: "End user / customer", isSystem: true },
  ];

  for (const def of roleDefinitions) {
    await prisma.role.upsert({
      where: { code: def.code },
      update: { title: def.title, description: def.description, isSystem: def.isSystem },
      create: { code: def.code, title: def.title, description: def.description, isSystem: def.isSystem },
    });
  }

  // Assign permissions to roles
  for (const [roleCode, permissionCodes] of Object.entries(PERMISSION_MATRIX)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;

    for (const permCode of permissionCodes) {
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!permission) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}