// Runtime verification for workflow hardening + Search form persistence
// Tests:
// 1. Login as operator_price
// 2. Submit a search form
// 3. Verify CustomerForm.workflowCode + workflowStarted
// 4. Verify WorkflowInstance exists
// 5. Verify first WorkflowStepInstance exists with status ASSIGNED + assignedToId
// 6. Verify assignedToId belongs to an active operator in PRICE department
// 7. Test IDOR: operator_sell cannot read operator_price's step

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) {
    console.log(`  ✅ ${name}${extra ? ` — ${extra}` : ""}`);
    pass++;
  } else {
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
    fail++;
  }
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/operator/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const tokenMatch = setCookie.match(/token=([^;]+)/);
  if (!tokenMatch) {
    console.log(`  ❌ Login failed for ${username}: status ${res.status}`);
    return null;
  }
  return tokenMatch[1];
}

async function submitSearchForm(token) {
  const res = await fetch(`${BASE}/api/forms/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: JSON.stringify({
      formType: "search",
      formData: {
        nm: "تست",
        fm: "کاربر",
        uph: "09129998877",
        hk: "site",
        type: "search",
      },
    }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("  Runtime Verification: Workflow Hardening");
  console.log("═══════════════════════════════════════\n");

  // ─── Step 1: Login as operator_price ───
  console.log("📌 Step 1: Login as operator_price");
  const priceToken = await login("operator_price", "operator123");
  check("operator_price login", !!priceToken);
  if (!priceToken) {
    console.log("\nCannot continue without operator token. Check server/DB.");
    process.exit(1);
  }

  // ─── Step 2: Submit search form ───
  console.log("\n📌 Step 2: Submit search form");
  const { status, json } = await submitSearchForm(priceToken);
  check("Search form submitted (201)", status === 201, `status=${status}`);
  check("Response has workflowCode", !!json?.data?.workflowCode, json?.data?.workflowCode || "null");
  check("Response has workflowStarted=true", json?.data?.workflowStarted === true);

  const formId = json?.data?.id;
  check("Response has form id", !!formId);
  if (!formId) {
    console.log("\nCannot continue without form id.");
    process.exit(1);
  }

  // ─── Step 3: Verify CustomerForm persistence ───
  console.log("\n📌 Step 3: Verify CustomerForm persistence");
  const form = await prisma.customerForm.findUnique({
    where: { id: formId },
    select: { id: true, workflowCode: true, workflowStarted: true, metadata: true },
  });
  check("CustomerForm exists", !!form);
  check("CustomerForm.workflowCode is non-null", !!form?.workflowCode, form?.workflowCode || "null");
  check("CustomerForm.workflowStarted = true", form?.workflowStarted === true);
  check("workflowCode = PRICE_SEARCH", form?.workflowCode === "PRICE_SEARCH", form?.workflowCode || "null");
  check("metadata has workflowInstanceId", !!form?.metadata?.workflowInstanceId);

  // ─── Step 4: Verify WorkflowInstance ───
  console.log("\n📌 Step 4: Verify WorkflowInstance");
  const instanceId = form?.metadata?.workflowInstanceId;
  const instance = instanceId
    ? await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: {
          version: { include: { workflow: true } },
          stepInstances: true,
        },
      })
    : null;
  check("WorkflowInstance exists", !!instance);
  check("WorkflowInstance.status = IN_PROGRESS", instance?.status === "IN_PROGRESS", instance?.status || "null");
  check("WorkflowInstance.customerFormId matches", instance?.customerFormId === formId);
  check("Workflow code = PRICE_SEARCH", instance?.version?.workflow?.code === "PRICE_SEARCH");

  // ─── Step 5: Verify first WorkflowStepInstance ───
  console.log("\n📌 Step 5: Verify first WorkflowStepInstance");
  const stepInstances = instance?.stepInstances ?? [];
  check("At least one StepInstance exists", stepInstances.length > 0, `count=${stepInstances.length}`);
  const firstStep = stepInstances[0];
  check("First StepInstance.status = ASSIGNED", firstStep?.status === "ASSIGNED", firstStep?.status || "null");
  check("First StepInstance.assignedToId is set", !!firstStep?.assignedToId);

  // ─── Step 6: Verify assignedToId belongs to active operator in PRICE ───
  console.log("\n📌 Step 6: Verify assignedToId is an active operator in PRICE");
  const assignedUser = firstStep?.assignedToId
    ? await prisma.user.findUnique({
        where: { id: firstStep.assignedToId },
        include: {
          agentProfile: true,
          roleAssignments: { include: { role: true } },
        },
      })
    : null;
  check("assignedToId references a User", !!assignedUser);
  check("User is active", assignedUser?.active === true);
  check("User has Agent profile", !!assignedUser?.agentProfile);
  check("Agent is active", assignedUser?.agentProfile?.active === true);
  check("Agent.department = PRICE", assignedUser?.agentProfile?.department === "PRICE", assignedUser?.agentProfile?.department || "null");
  const hasOperatorRole = assignedUser?.roleAssignments?.some((ra) => ra.role.code === "operator") ?? false;
  check("User has role=operator", hasOperatorRole);

  // ─── Step 7: Verify active Agent WITHOUT role=operator is NOT selected ───
  console.log("\n📌 Step 7: Verify non-operator agents are not selected");
  const nonOperatorAgents = await prisma.agent.findMany({
    where: {
      department: "PRICE",
      active: true,
      user: {
        active: true,
        roleAssignments: {
          none: { role: { code: "operator" } },
        },
      },
    },
    select: { userId: true },
  });
  const nonOperatorIds = new Set(nonOperatorAgents.map((a) => a.userId));
  check(
    "assignedToId is NOT a non-operator agent",
    !nonOperatorIds.has(firstStep?.assignedToId),
    `non-operator agents in PRICE: ${nonOperatorAgents.length}`
  );

  // ─── Step 8: IDOR test — operator_sell cannot read operator_price's step ───
  console.log("\n📌 Step 8: IDOR test — cross-operator step read");
  const sellToken = await login("operator_sell", "operator123");
  check("operator_sell login", !!sellToken);
  if (sellToken && firstStep) {
    const idorRes = await fetch(`${BASE}/api/workflow/step/${firstStep.id}`, {
      headers: { Cookie: `token=${sellToken}` },
    });
    check(
      "operator_sell gets 403 on operator_price's step",
      idorRes.status === 403,
      `status=${idorRes.status}`
    );
  }

  // ─── Step 9: IDOR test — operator_price CAN read own step ───
  console.log("\n📌 Step 9: IDOR test — owner can read own step");
  if (priceToken && firstStep) {
    const ownerRes = await fetch(`${BASE}/api/workflow/step/${firstStep.id}`, {
      headers: { Cookie: `token=${priceToken}` },
    });
    check(
      "operator_price can read own step (200)",
      ownerRes.status === 200,
      `status=${ownerRes.status}`
    );
  }

  // ─── Step 10: IDOR test — completeStep cross-operator ───
  console.log("\n📌 Step 10: IDOR test — cross-operator completeStep");
  if (sellToken && firstStep) {
    const idorCompleteRes = await fetch(`${BASE}/api/workflow/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${sellToken}`,
      },
      body: JSON.stringify({ stepInstanceId: firstStep.id, action: "COMPLETE" }),
    });
    check(
      "operator_sell gets 403 completing operator_price's step",
      idorCompleteRes.status === 403,
      `status=${idorCompleteRes.status}`
    );
  }

  // ─── Summary ───
  console.log("\n═══════════════════════════════════════");
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log("═══════════════════════════════════════\n");

  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("Fatal error:", e);
  await prisma.$disconnect();
  process.exit(1);
});
