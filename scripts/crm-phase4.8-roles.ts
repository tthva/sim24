/**
 * CRM Phase 4.8a seed — CRM permissions, roles, links, and test assignments.
 * Idempotent: safe to run multiple times (upsert by code).
 *
 * 1. Upserts 3 permissions: crm.read, crm.manage, crm.view_all
 * 2. Upserts 2 roles: crm_manager, crm_operator
 * 3. Links:
 *    - crm_manager  -> crm.read, crm.manage, crm.view_all
 *    - crm_operator -> crm.read
 *    - admin        -> crm.read, crm.manage, crm.view_all (explicit; admin already has "*")
 * 4. Assigns:
 *    - operator_product -> crm_operator
 *    - admin            -> crm_manager (keeps existing admin role)
 * 5. Creates test user (phase 4.8b-3):
 *    - crm_tester / crm_tester123 — crm_manager role ONLY (no crm_operator),
 *      used by Playwright UI tests to verify the /crm landing redirect.
 *
 * Run with: npx tsx scripts/crm-phase4.8-roles.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { code: "crm.read", name: "خواندن CRM", group: "CRM", description: "View CRM customers, tasks, communications" },
  { code: "crm.manage", name: "مدیریت CRM", group: "CRM", description: "Edit CRM rules, settings, and delete records" },
  { code: "crm.view_all", name: "مشاهده همه CRM", group: "CRM", description: "See all CRM customers (managers only)" },
];

const ROLES = [
  { code: "crm_manager", title: "مدیر CRM", description: "Full CRM access", isSystem: true },
  { code: "crm_operator", title: "اپراتور CRM", description: "CRM read-only operator", isSystem: true },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  crm_manager: ["crm.read", "crm.manage", "crm.view_all"],
  crm_operator: ["crm.read"],
  admin: ["crm.read", "crm.manage", "crm.view_all"],
};

const TEST_ASSIGNMENTS: Array<{ username: string; roleCode: string }> = [
  { username: "operator_product", roleCode: "crm_operator" },
  { username: "admin", roleCode: "crm_manager" },
];

// Phase 4.8b-3: dedicated CRM UI-test user.
// NOTE: Agent.department is a non-nullable enum in the schema and
// /api/operator/auth returns 401 without a profile, so the profile must
// have a department. The department never affects the landing page here:
// getLandingPage short-circuits on hasCrmAccess (/crm) before the
// department mapping. crm_tester gets ONLY the crm_manager role
// (no crm_operator / operator role assignments).
const TEST_USERS: Array<{
  username: string;
  password: string;
  userType: "AGENT";
  department: "PRICE";
  roleCode: string;
}> = [
  {
    username: "crm_tester",
    password: "crm_tester123",
    userType: "AGENT",
    department: "PRICE",
    roleCode: "crm_manager",
  },
];

async function main() {
  const touched = { permissions: 0, roles: 0, links: 0, assignments: 0 };

  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, group: p.group, description: p.description },
      create: { code: p.code, name: p.name, group: p.group, description: p.description },
    });
    touched.permissions += 1;
    console.log(`  ✅ permission upserted: ${p.code}`);
  }

  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { title: r.title, description: r.description, isSystem: r.isSystem },
      create: { code: r.code, title: r.title, description: r.description, isSystem: r.isSystem },
    });
    touched.roles += 1;
    console.log(`  ✅ role upserted: ${r.code}`);
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error(`Role "${roleCode}" not found after upsert`);
    for (const permCode of permissionCodes) {
      const permission = await prisma.permission.findUnique({ where: { code: permCode } });
      if (!permission) throw new Error(`Permission "${permCode}" not found after upsert`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
      touched.links += 1;
      console.log(`  ✅ link ensured: ${roleCode} -> ${permCode}`);
    }
  }

  for (const { username, roleCode } of TEST_ASSIGNMENTS) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new Error(`User "${username}" not found; cannot assign ${roleCode}`);
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error(`Role "${roleCode}" not found after upsert`);
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    touched.assignments += 1;
    console.log(`  ✅ assignment ensured: ${username} -> ${roleCode}`);
  }

  // Phase 4.8b-3: dedicated CRM test user (idempotent upsert by username)
  for (const u of TEST_USERS) {
    const password = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { username: u.username },
      // Re-assert password/active/userType on every run so the known test
      // credential always works, without touching role assignments here.
      update: { password, active: true, userType: u.userType },
      create: {
        username: u.username,
        password,
        active: true,
        userType: u.userType,
      },
    });
    // Login (/api/operator/auth) 401s without a profile, so ensure one exists.
    await prisma.agent.upsert({
      where: { userId: user.id },
      update: { active: true },
      create: {
        userId: user.id,
        department: u.department,
        active: true,
        adminId: null,
      },
    });
    const role = await prisma.role.findUnique({ where: { code: u.roleCode } });
    if (!role) throw new Error(`Role "${u.roleCode}" not found after upsert`);
    await prisma.userRoleAssignment.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    touched.assignments += 1;
    console.log(`  ✅ test user ready: ${u.username} / ${u.password} -> ${u.roleCode}`);
  }

  console.log("📊 summary:", JSON.stringify(touched));
}

main()
  .catch((e) => {
    console.error("❌ seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
