// ============================
// SIM24 — ERP Database Seed
// ============================
// Creates:
// 1. System users (admin + agents per department)
// 2. All 7 workflows with correct step routing
// 3. Test agents for each department
// ============================

import { PrismaClient, Department, UserType } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { seedDefaultRBAC, assignRole } from "../lib/rbac";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────

async function createUser(
  username: string,
  password: string,
  userType: UserType,
  fullName: string,
  phone?: string
) {
  return prisma.user.upsert({
    where: { username },
    update: { fullName, phone },
    create: {
      username,
      password: await hashPassword(password),
      fullName,
      phone,
      userType,
      active: true,
    },
  });
}

async function createAdmin(userId: string, department: Department) {
  return prisma.admin.upsert({
    where: { userId },
    update: { department },
    create: { userId, department },
  });
}

async function createAgent(
  userId: string,
  department: Department,
  adminId: string
) {
  return prisma.agent.upsert({
    where: { userId },
    update: { department, adminId },
    create: { userId, department, adminId, active: true },
  });
}

// ─── Workflow Step Builder ────────────────────────────────────────────────

type StepDef = {
  stepOrder: number;
  code: string;
  title: string;
  department: Department;
  isInitial: boolean;
  isFinal: boolean;
  formSchema: object;
  allowedActions: string[];
};

function createStep(
  order: number,
  code: string,
  title: string,
  department: Department,
  isInitial: boolean,
  isFinal: boolean,
  allowedActions: string[] = ["complete", "reject"],
  formSchema: object = {}
): StepDef {
  return {
    stepOrder: order,
    code,
    title,
    department,
    isInitial,
    isFinal,
    formSchema,
    allowedActions,
  };
}

async function upsertRequiredWorkflow(
  systemUserId: string,
  def: {
    code: string;
    title: string;
    description: string;
    department: Department;
    steps: StepDef[];
  }
) {
  const workflow = await prisma.workflow.upsert({
    where: { code: def.code },
    update: {
      title: def.title,
      description: def.description,
      department: def.department,
      status: "ACTIVE",
      updatedById: systemUserId,
    },
    create: {
      code: def.code,
      title: def.title,
      description: def.description,
      department: def.department,
      status: "ACTIVE",
      createdById: systemUserId,
      updatedById: systemUserId,
    },
  });

  const version = await prisma.workflowVersion.upsert({
    where: {
      workflowId_version: {
        workflowId: workflow.id,
        version: 1,
      },
    },
    update: {
      schema: {},
      createdById: systemUserId,
    },
    create: {
      workflowId: workflow.id,
      version: 1,
      schema: {},
      createdById: systemUserId,
    },
  });

  // توجه: مراحل را delete+create «نمی‌کنیم» چون WorkflowStepInstance ها با FK به
  // stepId وصل‌اند و حذف، constraint violation و از بین رفتن تاریخچه نمونه‌ها می‌دهد.
  // به‌جای آن: مراحل موجود را بر اساس (versionId, stepOrder) به‌روزرسانی می‌کنیم،
  // برای سفارش‌های جدید مرحله می‌سازیم و مرحله‌های حذف‌شده را فقط اگر هیچ
  // نمونه‌ای به آن‌ها ارجاع ندهد پاک می‌کنیم:
  const existingSteps = await prisma.workflowStep.findMany({
    where: { versionId: version.id },
  });
  const existingByOrder = new Map(existingSteps.map((s) => [s.stepOrder, s]));

  for (const step of def.steps) {
    const data = {
      code: step.code,
      title: step.title,
      department: step.department,
      formSchema: step.formSchema as any,
      allowedActions: step.allowedActions,
      isInitial: step.isInitial,
      isFinal: step.isFinal,
    };
    const existing = existingByOrder.get(step.stepOrder);
    if (existing) {
      await prisma.workflowStep.update({ where: { id: existing.id }, data });
    } else {
      await prisma.workflowStep.create({
        data: { versionId: version.id, stepOrder: step.stepOrder, ...data },
      });
    }
  }

  const keepOrders = new Set(def.steps.map((s) => s.stepOrder));
  for (const s of existingSteps) {
    if (!keepOrders.has(s.stepOrder)) {
      const refCount = await prisma.workflowStepInstance.count({
        where: { stepId: s.id },
      });
      if (refCount === 0) {
        await prisma.workflowStep.delete({ where: { id: s.id } });
      } else {
        console.log(
          `⚠️  ${def.code}: step #${s.stepOrder} (${s.code}) kept — ${refCount} instance(s) still reference it`,
        );
      }
    }
  }

  console.log(`✅ ${def.code}: upserted with ${def.steps.length} step(s)`);
}

// ─── Main Seed ────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding SIM24 ERP database...\n");

  // ============================
  // 1. Create System Users
  // ============================

  // Super admin (system-wide)
  const superAdminUser = await createUser(
    "admin",
    "admin",
    "ADMIN",
    "مدیر سیستم",
    "09120000000"
  );
  await createAdmin(superAdminUser.id, "PRICE");
  console.log("✅ Super admin user created:", superAdminUser.username);

  // ─── PRICE Department ───
  const priceAdminUser = await createUser(
    "price_admin",
    "password123",
    "ADMIN",
    "مدیر کارشناسان قیمت",
    "09120000001"
  );
  const priceAdmin = await createAdmin(priceAdminUser.id, "PRICE");

  const priceAgent1User = await createUser(
    "price_agent1",
    "password123",
    "AGENT",
    "کارشناس قیمت ۱",
    "09120000002"
  );
  await createAgent(priceAgent1User.id, "PRICE", priceAdmin.id);

  const operatorPriceUser = await createUser(
    "operator_price",
    "operator123",
    "AGENT",
    "اپراتور قیمت",
    "09120000101"
  );
  await createAgent(operatorPriceUser.id, "PRICE", priceAdmin.id);

  const priceAgent2User = await createUser(
    "price_agent2",
    "password123",
    "AGENT",
    "کارشناس قیمت ۲",
    "09120000003"
  );
  await createAgent(priceAgent2User.id, "PRICE", priceAdmin.id);

  // ─── INVESTMENT Department ───
  const investAdminUser = await createUser(
    "invest_admin",
    "password123",
    "ADMIN",
    "مدیر سرمایه‌گذاری",
    "09120000004"
  );
  const investAdmin = await createAdmin(investAdminUser.id, "INVESTMENT");

  const investAgent1User = await createUser(
    "invest_agent1",
    "password123",
    "AGENT",
    "کارشناس سرمایه‌گذاری ۱",
    "09120000005"
  );
  await createAgent(investAgent1User.id, "INVESTMENT", investAdmin.id);

  const operatorInvestmentUser = await createUser(
    "operator_investment",
    "operator123",
    "AGENT",
    "اپراتور سرمایه‌گذاری",
    "09120000102"
  );
  await createAgent(operatorInvestmentUser.id, "INVESTMENT", investAdmin.id);

  // ─── PRODUCT Department ───
  const productAdminUser = await createUser(
    "product_admin",
    "password123",
    "ADMIN",
    "مدیر محصول",
    "09120000006"
  );
  const productAdmin = await createAdmin(productAdminUser.id, "PRODUCT");

  const productAgent1User = await createUser(
    "product_agent1",
    "password123",
    "AGENT",
    "مدیر محصول ۱",
    "09120000007"
  );
  await createAgent(productAgent1User.id, "PRODUCT", productAdmin.id);

  const operatorProductUser = await createUser(
    "operator_product",
    "operator123",
    "AGENT",
    "اپراتور محصول",
    "09120000103"
  );
  await createAgent(operatorProductUser.id, "PRODUCT", productAdmin.id);

  const productAgent2User = await createUser(
    "product_agent2",
    "password123",
    "AGENT",
    "مدیر محصول ۲",
    "09120000008"
  );
  await createAgent(productAgent2User.id, "PRODUCT", productAdmin.id);

  // ─── SELL Department ───
  const sellAdminUser = await createUser(
    "sell_admin",
    "password123",
    "ADMIN",
    "مدیر فروش",
    "09120000009"
  );
  const sellAdmin = await createAdmin(sellAdminUser.id, "SELL");

  const sellAgent1User = await createUser(
    "sell_agent1",
    "password123",
    "AGENT",
    "مدیر فروش ۱",
    "09120000010"
  );
  await createAgent(sellAgent1User.id, "SELL", sellAdmin.id);

  const operatorSellUser = await createUser(
    "operator_sell",
    "operator123",
    "AGENT",
    "اپراتور فروش",
    "09120000104"
  );
  await createAgent(operatorSellUser.id, "SELL", sellAdmin.id);

  const agent1User = await createUser(
    "agent1",
    "agent123",
    "AGENT",
    "نماینده ۱",
    "09120000105"
  );
  await createAgent(agent1User.id, "SELL", sellAdmin.id);

  const sellAgent2User = await createUser(
    "sell_agent2",
    "password123",
    "AGENT",
    "مدیر فروش ۲",
    "09120000011"
  );
  await createAgent(sellAgent2User.id, "SELL", sellAdmin.id);

  // ─── End Users (user1, user2) — stored in end_users table ───
  // These users authenticate via /api/auth/enduser, NOT /api/operator/auth
  await prisma.endUser.upsert({
    where: { username: "user1" },
    update: { phone: "09120000110", fullName: "کاربر ۱" },
    create: {
      username: "user1",
      password: await hashPassword("user123"),
      phone: "09120000110",
      fullName: "کاربر ۱",
      active: true,
    },
  });

  await prisma.endUser.upsert({
    where: { username: "user2" },
    update: { phone: "09120000111", fullName: "کاربر ۲" },
    create: {
      username: "user2",
      password: await hashPassword("user123"),
      phone: "09120000111",
      fullName: "کاربر ۲",
      active: true,
    },
  });

  console.log("✅ End users created: user1, user2 (via /api/auth/enduser)");

  console.log("✅ All department admins and agents created");
  console.log("   PRICE:     2 agents");
  console.log("   INVESTMENT: 1 agent");
  console.log("   PRODUCT:   2 agents");
  console.log("   SELL:      2 agents\n");

  // ============================
  // 2. Create Workflow Definitions
  // ============================

  const systemUserId = superAdminUser.id;

  // --- Workflow 1: SIM_SALE (PRICE → SELL → PRODUCT) ---
  await prisma.workflow.upsert({
    where: { code: "SIM_SALE" },
    update: {},
    create: {
      code: "SIM_SALE",
      title: "فروش سیم‌کارت",
      description: "فرآیند فروش سیم‌کارت: کارشناسی قیمت → فروش → انتشار",
      department: "PRICE",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "price-verification", "کارشناسی قیمت", "PRICE", true, false),
              createStep(2, "sell-execution", "انجام فروش", "SELL", false, false),
              createStep(3, "product-publish", "انتشار نهایی", "PRODUCT", false, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ SIM_SALE: PRICE → SELL → PRODUCT");

  // --- Workflow 2: MARKET_VALUE (PRICE only) ---
  await prisma.workflow.upsert({
    where: { code: "MARKET_VALUE" },
    update: {},
    create: {
      code: "MARKET_VALUE",
      title: "ارزش واقعی بازار",
      description: "کارشناسی و ارزش‌گذاری سیم‌کارت",
      department: "PRICE",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "market-value-analysis", "تحلیل ارزش بازار", "PRICE", true, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ MARKET_VALUE: PRICE");

  // --- Workflow 3: SIM_SWAP (PRICE → PRODUCT → SELL → PRODUCT) ---
  await prisma.workflow.upsert({
    where: { code: "SIM_SWAP" },
    update: {},
    create: {
      code: "SIM_SWAP",
      title: "تعویض سیم‌کارت",
      description: "فرآیند تعویض سیم‌کارت: قیمت → محصول → فروش → محصول",
      department: "PRICE",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "swap-price-check", "بررسی قیمت تعویض", "PRICE", true, false),
              createStep(2, "swap-product-check", "بررسی محصول", "PRODUCT", false, false),
              createStep(3, "swap-execution", "انجام تعویض", "SELL", false, false),
              createStep(4, "swap-finalize", "نهایی‌سازی تعویض", "PRODUCT", false, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ SIM_SWAP: PRICE → PRODUCT → SELL → PRODUCT");

  // --- Workflow 4: SIM_BUY (PRODUCT → SELL) ---
  await prisma.workflow.upsert({
    where: { code: "SIM_BUY" },
    update: {},
    create: {
      code: "SIM_BUY",
      title: "خرید سیم‌کارت",
      description: "فرآیند خرید سیم‌کارت: بررسی محصول → تکمیل خرید",
      department: "PRODUCT",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "buy-product-review", "بررسی محصول", "PRODUCT", true, false),
              createStep(2, "buy-completion", "تکمیل خرید", "SELL", false, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ SIM_BUY: PRODUCT → SELL");

  // --- Workflow 5: PRE_ORDER (SELL only) ---
  await prisma.workflow.upsert({
    where: { code: "PRE_ORDER" },
    update: {},
    create: {
      code: "PRE_ORDER",
      title: "پیش‌سفارش",
      description: "ثبت و پیگیری پیش‌سفارش سیم‌کارت",
      department: "SELL",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "preorder-registration", "ثبت پیش‌سفارش", "SELL", true, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ PRE_ORDER: SELL");

  // --- Workflow 6: INVESTMENT (INVESTMENT only) ---
  await prisma.workflow.upsert({
    where: { code: "INVESTMENT" },
    update: {},
    create: {
      code: "INVESTMENT",
      title: "سرمایه‌گذاری",
      description: "فرآیند سرمایه‌گذاری در سیم‌کارت",
      department: "INVESTMENT",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "investment-analysis", "تحلیل سرمایه‌گذاری", "INVESTMENT", true, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ INVESTMENT: INVESTMENT");

  // --- Workflow 7: CONSIGNMENT_SALE (PRICE → SELL → PRODUCT) ---
  await prisma.workflow.upsert({
    where: { code: "CONSIGNMENT_SALE" },
    update: {},
    create: {
      code: "CONSIGNMENT_SALE",
      title: "فروش امانی",
      description: "فرآیند فروش امانی سیم‌کارت: قیمت → فروش → انتشار",
      department: "PRICE",
      status: "ACTIVE",
      createdById: systemUserId,
      versions: {
        create: {
          version: 1,
          schema: {},
          createdById: systemUserId,
          steps: {
            create: [
              createStep(1, "consignment-price", "کارشناسی قیمت امانی", "PRICE", true, false),
              createStep(2, "consignment-sell", "ثبت فروش امانی", "SELL", false, false),
              createStep(3, "consignment-publish", "انتشار امانی", "PRODUCT", false, true),
            ],
          },
        },
      },
    },
  });
  console.log("✅ CONSIGNMENT_SALE: PRICE → SELL → PRODUCT\n");

  // ============================
  // 3. Phase 4 Required Workflows (Idempotent Upsert)
  // ============================
  console.log("🧩 Upserting required Phase 4 workflows...\n");

  const requiredWorkflows = [
    {
      code: "BUY_DIRECT",
      title: "خرید مستقیم",
      description: "فرآیند خرید مستقیم سیم‌کارت",
      department: "PRODUCT" as Department,
      steps: [
        createStep(1, "buy-direct-product-review", "بررسی محصول", "PRODUCT", true, false),
        createStep(2, "buy-direct-sell-complete", "انجام فروش", "SELL", false, false),
        createStep(3, "buy-direct-product-final", "بررسی نهایی محصول", "PRODUCT", false, true),
      ],
    },
    {
      code: "BUY_INSTALLMENT",
      title: "خرید اقساطی",
      description: "فرآیند خرید اقساطی سیم‌کارت",
      department: "PRODUCT" as Department,
      steps: [
        createStep(1, "buy-installment-product-review", "بررسی محصول", "PRODUCT", true, false),
        createStep(2, "buy-installment-sell-complete", "انجام فروش", "SELL", false, false),
        createStep(3, "buy-installment-product-final", "بررسی نهایی محصول", "PRODUCT", false, true),
      ],
    },
    {
      code: "BUY_PREORDER",
      title: "پیش‌خرید سیم‌کارت",
      description: "فرآیند ثبت و پیگیری پیش‌خرید",
      department: "SELL" as Department,
      steps: [
        createStep(1, "buy-preorder-register", "ثبت پیش‌خرید", "SELL", true, false),
        createStep(2, "buy-preorder-product-review", "بررسی پیش‌خرید", "PRODUCT", false, true),
      ],
    },
    {
      code: "SELL_DIRECT",
      title: "فروش مستقیم",
      description: "فرآیند فروش مستقیم سیم‌کارت",
      department: "PRICE" as Department,
      steps: [
        createStep(1, "sell-direct-price-review", "کارشناسی قیمت", "PRICE", true, false),
        createStep(2, "sell-direct-execution", "انجام فروش", "SELL", false, false),
        createStep(3, "sell-direct-product-review", "بررسی محصول", "PRODUCT", false, true),
      ],
    },
    {
      code: "SELL_MARKET_SWAP",
      title: "تعویض / فروش بازاری",
      description: "فرآیند تعویض یا فروش بازاری سیم‌کارت",
      department: "PRICE" as Department,
      steps: [
        createStep(1, "sell-market-price-review", "کارشناسی قیمت", "PRICE", true, false),
        createStep(2, "sell-market-product-review", "بررسی محصول", "PRODUCT", false, false),
        createStep(3, "sell-market-execution", "انجام تعویض/فروش", "SELL", false, false),
        createStep(4, "sell-market-site-removal", "حذف از سایت", "PRODUCT", false, false),
        createStep(5, "sell-market-finalize", "نهایی‌سازی تعویض/فروش", "PRODUCT", false, true),
      ],
    },
    {
      code: "SELL_CONSIGNMENT",
      title: "فروش امانی",
      description: "فرآیند فروش امانی سیم‌کارت",
      department: "PRICE" as Department,
      steps: [
        createStep(1, "sell-consignment-price-review", "کارشناسی قیمت امانی", "PRICE", true, false),
        createStep(2, "sell-consignment-execution", "ثبت/انجام فروش امانی", "SELL", false, false),
        createStep(3, "sell-consignment-product-review", "بررسی محصول امانی", "PRODUCT", false, true),
      ],
    },
    {
      code: "INVESTMENT_REQUEST",
      title: "درخواست سرمایه‌گذاری",
      description: "بررسی و نهایی‌سازی درخواست سرمایه‌گذاری",
      department: "INVESTMENT" as Department,
      steps: [
        createStep(1, "investment-request-review", "بررسی درخواست سرمایه‌گذاری", "INVESTMENT", true, true),
      ],
    },
    {
      code: "PRICE_SEARCH",
      title: "کارشناسی ارزش واقعی",
      description: "بررسی و اعلام ارزش واقعی بازار",
      department: "PRICE" as Department,
      steps: [
        createStep(1, "price-search-analysis", "بررسی ارزش واقعی", "PRICE", true, true),
      ],
    },
  ];

  for (const wf of requiredWorkflows) {
    await upsertRequiredWorkflow(systemUserId, wf);
  }

  console.log("\n✅ Required Phase 4 workflows upserted successfully.");
  console.log("   1. BUY_DIRECT");
  console.log("   2. BUY_INSTALLMENT");
  console.log("   3. BUY_PREORDER");
  console.log("   4. SELL_DIRECT");
  console.log("   5. SELL_MARKET_SWAP");
  console.log("   6. SELL_CONSIGNMENT");
  console.log("   7. INVESTMENT_REQUEST");
  console.log("   8. PRICE_SEARCH");

  // ============================
  // 4. Seed RBAC Roles & Permissions
  // ============================
  console.log("🔐 Seeding RBAC roles and permissions...\n");
  await seedDefaultRBAC();

  // Assign roles to all seeded users
  const allUsers = await prisma.user.findMany();
  for (const user of allUsers) {
    // Determine role based on user profile
    if (user.userType === "ADMIN") {
      // Admins get "admin" role
      try { await assignRole(user.id, "admin"); } catch { /* already assigned */ }
    } else if (user.userType === "AGENT") {
      // Agents/operators get "agent" role by default
      // Operators (who have "operator" in username) also get "operator" role
      try { await assignRole(user.id, "agent"); } catch { /* already assigned */ }
      if (user.username.startsWith("operator_")) {
        try { await assignRole(user.id, "operator"); } catch { /* already assigned */ }
      }
    }
  }

  console.log("✅ RBAC roles and permissions seeded successfully.\n");

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📋 Legacy Workflow Summary (unchanged):");
  console.log("  1. SIM_SALE         → PRICE → SELL → PRODUCT");
  console.log("  2. MARKET_VALUE     → PRICE");
  console.log("  3. SIM_SWAP         → PRICE → PRODUCT → SELL → PRODUCT");
  console.log("  4. SIM_BUY          → PRODUCT → SELL");
  console.log("  5. PRE_ORDER        → SELL");
  console.log("  6. INVESTMENT       → INVESTMENT");
  console.log("  7. CONSIGNMENT_SALE → PRICE → SELL → PRODUCT");
  console.log("\n🔐 Test Credentials:");
  console.log("  Admin (via /api/admin/auth): admin / admin");
  console.log("  Operator PRICE (agent-auth): operator_price / operator123");
  console.log("  Operator SELL (agent-auth): operator_sell / operator123");
  console.log("  Operator PRODUCT (agent-auth): operator_product / operator123");
  console.log("  Operator INVESTMENT (agent-auth): operator_investment / operator123");
  console.log("  Agent (via /api/agent/auth): agent1 / agent123");
  console.log("  Customer-like (via /api/auth/login): requires username/password/otp (6-digit format)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });