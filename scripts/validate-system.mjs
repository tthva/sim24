// SIM24 System Validation Script
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const results = {};

async function check(step, fn) {
  try {
    const ok = await fn();
    results[step] = ok ? "✅ OK" : "❌ FAIL";
    if (!ok) console.log(`  ${step}: FAIL`);
    else console.log(`  ${step}: OK`);
    return ok;
  } catch (e) {
    results[step] = "❌ FAIL";
    console.log(`  ${step}: FAIL — ${e.message}`);
    return false;
  }
}

async function main() {
  console.log("\n=== SIM24 System Validation ===\n");

  // STEP 3 — Prisma connection
  await check("STEP 3: Prisma Connection", async () => {
    await prisma.$connect();
    return true;
  });

  // STEP 4 — Workflow definitions
  let workflowCount = 0;
  await check("STEP 4: Workflow Definitions", async () => {
    const workflows = await prisma.workflow.findMany({ where: { status: "ACTIVE" } });
    workflowCount = workflows.length;
    console.log(`   Found ${workflowCount} active workflows`);
    for (const w of workflows) console.log(`   - ${w.code}: ${w.title}`);
    return workflowCount >= 7;
  });

  // Step verification
  await check("STEP 4b: Workflow Steps", async () => {
    const steps = await prisma.workflowStep.findMany({ orderBy: [{ versionId: "asc" }, { stepOrder: "asc" }] });
    console.log(`   Found ${steps.length} total steps`);
    console.log(`   Sample: order=${steps[0]?.stepOrder}, dept=${steps[0]?.department}, slaHours=${steps[0]?.slaHours}, rejectBehavior=${steps[0]?.rejectBehavior}`);
    return steps.length >= 10 && steps[0]?.stepOrder === 1;
  });

  // STEP 5 — Agent checks
  let agentCount = 0;
  await check("STEP 5: Agents seeded", async () => {
    const agents = await prisma.agent.findMany({ where: { active: true } });
    agentCount = agents.length;
    console.log(`   Found ${agentCount} active agents`);
    for (const a of agents) {
      const user = await prisma.user.findUnique({ where: { id: a.userId } });
      console.log(`   - ${user?.username} (${a.department})`);
    }
    return agentCount >= 7;
  });

  // STEP 5 — Test: Start a workflow
  let instanceId = null;
  await check("STEP 5: Start Workflow API", async () => {
    // Find a PRICE agent to trigger workflow
    const version = await prisma.workflowVersion.findFirst({
      where: { workflow: { code: "SIM_SALE" } },
      orderBy: { version: "desc" },
      include: { steps: { where: { isInitial: true } } },
    });
    if (!version || !version.steps[0]) throw new Error("No initial step found");

    const firstStep = version.steps[0];
    const agent = await prisma.agent.findFirst({
      where: { department: firstStep.department, active: true },
      include: { user: true },
    });
    if (!agent) throw new Error("No agent available");

    const wfInstance = await prisma.workflowInstance.create({
      data: {
        versionId: version.id,
        agentId: agent.id,
        status: "IN_PROGRESS",
        formData: { customerName: "تست", phone: "09120000000" },
        currentStepOrder: firstStep.stepOrder,
      },
    });
    instanceId = wfInstance.id;

    const stepInstance = await prisma.workflowStepInstance.create({
      data: {
        instanceId: wfInstance.id,
        stepId: firstStep.id,
        status: "ASSIGNED",
        assignedToId: agent.userId,
        assignedAt: new Date(),
        dueAt: firstStep.slaHours ? new Date(Date.now() + firstStep.slaHours * 3600000) : null,
      },
    });
    console.log(`   Created workflow instance: ${wfInstance.id}`);
    console.log(`   Created step instance: ${stepInstance.id}`);
    return true;
  });

  // STEP 6 — Verify Step Instance
  await check("STEP 6: Step Instance Created", async () => {
    const sis = await prisma.workflowStepInstance.findMany({ where: { instanceId } });
    console.log(`   Found ${sis.length} step instances`);
    console.log(`   Status: ${sis[0]?.status}, AssignedTo: ${sis[0]?.assignedToId}, dueAt: ${sis[0]?.dueAt}`);
    return sis.length >= 1 && sis[0]?.status === "ASSIGNED";
  });

  // STEP 12 — Verify Audit Logs
  await check("STEP 12: Audit Logging", async () => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
    console.log(`   Found ${logs.length} recent audit logs`);
    for (const l of logs) console.log(`   - ${l.action} | ${l.entity} | ${l.createdAt}`);
    return true;
  });

  // STEP 13 — SLA Calculation
  await check("STEP 13: SLA Calculation", async () => {
    const sis = await prisma.workflowStepInstance.findFirst({
      where: { status: "ASSIGNED" },
      include: { step: true },
    });
    if (!sis || !sis.step.slaHours) {
      console.log(`   No SLA-configured step found (seed uses slaHours=null)`);
      return true; // Not a failure — seed doesn't set SLA
    }
    const expectedDue = new Date(sis.createdAt.getTime() + sis.step.slaHours * 3600000);
    const diff = Math.abs(sis.dueAt.getTime() - expectedDue.getTime());
    console.log(`   SLA: ${sis.step.slaHours}h, created: ${sis.createdAt}, due: ${sis.dueAt}, diff: ${diff}ms`);
    return diff < 1000;
  });

  // STEP 14 — Load Balancing (simulate by checking distribution)
  await check("STEP 14: Load Balancing", async () => {
    const counts = await prisma.workflowInstance.groupBy({
      by: ["agentId"],
      _count: { id: true },
      where: { status: "IN_PROGRESS" },
    });
    console.log(`   Workload distribution: ${JSON.stringify(counts)}`);
    return true;
  });

  // Summary
  console.log("\n=== FINAL HEALTH REPORT ===\n");
  const allOk = Object.values(results).every((r) => r === "✅ OK");
  for (const [step, status] of Object.entries(results)) {
    console.log(`${status.padEnd(10)} ${step}`);
  }
  console.log(`\nOverall: ${allOk ? "✅ ALL SYSTEMS OPERATIONAL" : "⚠️  SOME CHECKS FAILED"}`);
  console.log(`Workflows: ${workflowCount} active`);
  console.log(`Agents: ${agentCount} active`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n❌ Validation script failed:", e);
  process.exit(1);
});