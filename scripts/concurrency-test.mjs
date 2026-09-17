import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

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

// ─── Login as operator_price ─────────────────────────────────────────────────
console.log("=== Logging in as operator_price ===");
const loginRes = await fetch(`${BASE}/api/operator/auth`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "operator_price", password: "operator123" }),
  redirect: "manual",
});
const setCookie = loginRes.headers.get("set-cookie") || "";
const tokenMatch = setCookie.match(/token=([^;]+)/);
check("Login as operator_price (200 + token cookie)", loginRes.status === 200 && !!tokenMatch);
if (!tokenMatch) {
  console.error("Login failed. Status:", loginRes.status);
  process.exit(1);
}
const cookie = `token=${tokenMatch[1]}`;
console.log("Logged in as operator_price\n");

// ─── Unique phone numbers per run ────────────────────────────────────────────
// Format: 09 + 9 digits (matches /^09\d{9}$/)
// Uses timestamp so re-runs don't collide with old test data.
const ts = Date.now();
const phones = Array.from({ length: 5 }, (_, i) =>
  `09${String(ts + i).slice(-9).padStart(9, "0")}`
);
console.log("Phone numbers:", phones.join(", "), "\n");

// ─── Requirement 1: Submit 5 concurrent search form requests ────────────────
console.log("=== Submitting 5 concurrent search forms (Promise.all) ===");
const startTime = Date.now();
const results = await Promise.all(
  phones.map((phone) =>
    fetch(`${BASE}/api/forms/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        formType: "search",
        formData: {
          nm: "ConcurrentTest",
          fm: phone.slice(-5),
          uph: phone,
          hk: "site",
          type: "search",
        },
      }),
    }).then(async (res) => ({
      phone,
      status: res.status,
      data: await res.json(),
      formId: res.status === 201 ? res.data?.id ?? null : null,
    }))
  )
);
const elapsed = Date.now() - startTime;
console.log(`All 5 requests completed in ${elapsed}ms\n`);

// Response-level checks
const successCount = results.filter((r) => r.status === 201).length;
check("5/5 form submissions return 201", successCount === 5, `${successCount}/5 succeeded`);

// ─── DB Verification ────────────────────────────────────────────────────────
console.log("\n=== DB Verification ===");

const forms = await prisma.customerForm.findMany({
  where: { phone: { in: phones } },
  select: {
    id: true,
    phone: true,
    workflowCode: true,
    workflowStarted: true,
    createdAt: true,
  },
});

console.log(`\nCustomerForms found: ${forms.length} (expected: ${phones.length})`);
check("5 CustomerForms found in DB", forms.length === phones.length);

if (forms.length > 0) {
  // ── Requirement 2: Each submitted form has workflowStarted=true ──
  check(
    "All forms have workflowStarted=true",
    forms.every((f) => f.workflowStarted === true)
  );

  // ── Requirement 3: Each submitted form has non-null workflowCode ──
  check(
    "All forms have non-null workflowCode",
    forms.every((f) => f.workflowCode !== null && f.workflowCode !== undefined)
  );

  // ── Requirement 4: Each submitted form has exactly one related WorkflowInstance ──
  const instances = await prisma.workflowInstance.findMany({
    where: { customerFormId: { in: forms.map((f) => f.id) } },
    select: {
      id: true,
      customerFormId: true,
      status: true,
      createdAt: true,
    },
  });

  const instanceCountPerForm = {};
  for (const inst of instances) {
    const key = inst.customerFormId;
    instanceCountPerForm[key] = (instanceCountPerForm[key] || 0) + 1;
  }

  console.log(`\nWorkflowInstances: ${instances.length} (expected: ${forms.length})`);
  check(
    "Exactly one WorkflowInstance per form",
    instances.length === forms.length &&
      forms.every((f) => instanceCountPerForm[f.id] === 1)
  );

  // ── Requirement 5: Each WorkflowInstance has exactly one initial StepInstance ──
  const validInstanceIds = instances.map((i) => i.id);
  const stepInstances = await prisma.workflowStepInstance.findMany({
    where: { instanceId: { in: validInstanceIds } },
    select: {
      id: true,
      status: true,
      assignedToId: true,
      instanceId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const stepCountsPerInstance = {};
  for (const si of stepInstances) {
    stepCountsPerInstance[si.instanceId] = (stepCountsPerInstance[si.instanceId] || 0) + 1;
  }

  console.log(`\nStepInstances: ${stepInstances.length} (expected: ${instances.length})`);
  check(
    "Each WorkflowInstance has exactly 1 initial StepInstance",
    instances.every((inst) => stepCountsPerInstance[inst.id] === 1)
  );

  // ── Requirement 6: Each StepInstance has status ASSIGNED ──
  check(
    "All StepInstances have status ASSIGNED",
    stepInstances.every((si) => si.status === "ASSIGNED")
  );

  // ── Requirement 7: Each StepInstance has non-null assignedToId ──
  check(
    "All StepInstances have non-null assignedToId",
    stepInstances.every((si) => si.assignedToId !== null && si.assignedToId !== undefined)
  );

  // ── Requirement 8-10: Verify assignee is active User + active Agent in PRICE + role=operator ──
  const assignedUserIds = [...new Set(stepInstances.map((s) => s.assignedToId).filter(Boolean))];

  const assignedUsers = await prisma.user.findMany({
    where: { id: { in: assignedUserIds } },
    include: {
      agentProfile: true,
      roleAssignments: { include: { role: true } },
    },
  });

  console.log("\n=== Assignee Verification ===");

  for (const si of stepInstances) {
    const user = assignedUsers.find((u) => u.id === si.assignedToId);
    const label = `Step ${si.id.substring(0, 8)}`;

    // Requirement 8: assignedToId belongs to an active User
    check(
      `${label}: assignedToId is active User`,
      !!user && user.active === true,
      user ? `active=${user.active}` : "user not found"
    );

    // Requirement 9: assignedToId belongs to an active Agent in PRICE department
    check(
      `${label}: belongs to active Agent in PRICE`,
      !!user?.agentProfile &&
        user.agentProfile.active === true &&
        user.agentProfile.department === "PRICE",
      user?.agentProfile
        ? `dept=${user.agentProfile.department}, active=${user.agentProfile.active}`
        : "no agent profile"
    );

    // Requirement 10: assignedToId has role code operator
    check(
      `${label}: has role=operator`,
      !!user && user.roleAssignments.some((ra) => ra.role.code === "operator"),
      user ? `roles=[${user.roleAssignments.map((ra) => ra.role.code).join(", ")}]` : "no roles"
    );
  }

  // ── Requirement 11: No non-operator Agent receives any task ──
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
  const nonOperatorUserIds = new Set(nonOperatorAgents.map((a) => a.userId));
  const noNonOperatorTasks = stepInstances.every(
    (si) => !nonOperatorUserIds.has(si.assignedToId)
  );
  console.log(
    `\nNon-operator active agents in PRICE dept: ${nonOperatorAgents.length}`
  );
  check("No non-operator Agent received any task", noNonOperatorTasks);

  // ── Requirement 12: No orphan StepInstance is created ──
  const validInstanceIdSet = new Set(validInstanceIds);
  const orphanSteps = stepInstances.filter(
    (si) => !validInstanceIdSet.has(si.instanceId)
  );
  check("No orphan StepInstance created", orphanSteps.length === 0);

  // ── Requirement 13: No duplicate WorkflowInstance for the same submitted form ──
  check(
    "No duplicate WorkflowInstance for same form",
    Object.values(instanceCountPerForm).every((c) => c === 1)
  );

  // ── Bonus: No orphan WorkflowInstance (unlinked to a form) ──
  const orphanedInstances = instances.filter(
    (inst) => !forms.some((f) => f.id === inst.customerFormId)
  );
  check("No orphan WorkflowInstance (unlinked to a form)", orphanedInstances.length === 0);

  // ── Show assignee distribution ──
  console.log("\n=== Assignee distribution ===");
  const assignments = {};
  for (const si of stepInstances) {
    const assignee = si.assignedToId?.substring(0, 8) || "NULL";
    assignments[assignee] = (assignments[assignee] || 0) + 1;
  }
  for (const [uid, count] of Object.entries(assignments)) {
    console.log(`  ${uid}...: ${count} tasks`);
  }
} else {
  console.log("❌ No forms found in DB — submissions likely failed at the API level.");
  fail++;
}

await prisma.$disconnect();
console.log("\n═══════════════════════════════════════");
console.log(`  Results: ${pass} passed, ${fail} failed`);
console.log("═══════════════════════════════════════\n");

process.exit(fail > 0 ? 1 : 0);
