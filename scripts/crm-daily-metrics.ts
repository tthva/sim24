/**
 * CRM Phase 4.3 — daily metrics snapshot into DailyMetric.
 *
 * Idempotent: re-running for the same day overwrites that day's row
 * (upsert on the unique `date`), so it is safe to backfill or re-run.
 *
 * Usage:
 *   npx tsx scripts/crm-daily-metrics.ts              # yesterday (server local time)
 *   npx tsx scripts/crm-daily-metrics.ts 2026-09-22   # explicit calendar day
 *
 * ─── Date handling (matters because DailyMetric.date is @db.Date) ───
 * The target day is interpreted as a calendar day in the server's LOCAL timezone:
 *   - metric windows are [local midnight, next local midnight)
 *   - the persisted value is UTC midnight of that same Y/M/D, so the DATE column
 *     stores the intended calendar date instead of drifting one day backwards
 *     for timezones ahead of UTC (this deployment runs +03:30).
 *
 * ─── Metric definitions (documented: several have >1 reasonable reading) ───
 * customersNew       Customer.createdAt in window
 * customersActive    distinct CustomerInteraction.customerId in window
 * formsSubmitted     CustomerForm.createdAt in window
 * formsByType        same rows grouped by CustomerForm.formType
 * tasksAssigned      WorkflowStepInstance.assignedAt in window
 * tasksCompleted     WorkflowStepInstance.completedAt in window
 * tasksRejected      TaskRejection.rejectedAt in window
 *                    (TaskRejection has no customerId -> CRM-wide count, not per-customer)
 * dealsCreated       Opportunity.createdAt in window
 * dealsWon/dealsLost Opportunity.wonAt / lostAt in window
 *                    (PipelineStage.isWon carries no date, so wonAt is the only
 *                     date-bounded source for a daily metric)
 * dealValue          SUM(estimatedValue) over dealsWon in window
 * revenue            SAME as dealValue — identical by definition here, kept as a
 *                    separate column so a future accounting source can diverge
 * smsSent/Received   Communication channel="sms"  direction="outbound"/"inbound"
 * callsMade          Communication channel="call" direction="outbound"
 * (all Communication metrics use createdAt, not sentAt, so mock/unsent rows with
 *  a null sentAt are still counted on the day they were recorded)
 * avgTaskDurationMin MEAN(completedAt - assignedAt) for WorkflowStepInstance rows
 *                    completed in window that have both timestamps; negative
 *                    deltas are clamped to 0
 * conversionRate     dealsWon / dealsCreated * 100, null when no deals were created
 */
import { prisma } from "@/lib/prisma";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDayLabel(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Resolve the target day. Explicit args must be `YYYY-MM-DD`; anything else
 * fails loudly instead of silently snapshotting a NaN/rolled-over date.
 */
function parseTargetDate(): Date {
  const arg = process.argv[2];
  if (!arg) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return startOfLocalDay(yesterday);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(arg.trim());
  if (!match) {
    throw new Error(`Invalid date "${arg}" — expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  // Reject rollovers such as 2026-02-31 (which JS would silently turn into Mar 3).
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${arg}".`);
  }

  return startOfLocalDay(parsed);
}

async function main() {
  const day = parseTargetDate();
  const start = startOfLocalDay(day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
  const window = { gte: start, lt: end };

  // @db.Date stores a calendar date, so normalise to UTC midnight of the same Y/M/D.
  const storedDate = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));

  const [
    customersNew,
    activeCustomers,
    formsSubmitted,
    formsByType,
    tasksAssigned,
    tasksCompleted,
    tasksRejected,
    completedSteps,
    dealsCreated,
    dealsWon,
    dealsLost,
    wonValueAgg,
    smsSent,
    smsReceived,
    callsMade,
  ] = await Promise.all([
    prisma.customer.count({ where: { createdAt: window } }),
    prisma.customerInteraction.groupBy({ by: ["customerId"], where: { createdAt: window } }),
    prisma.customerForm.count({ where: { createdAt: window } }),
    prisma.customerForm.groupBy({
      by: ["formType"],
      where: { createdAt: window },
      _count: { _all: true },
    }),
    prisma.workflowStepInstance.count({ where: { assignedAt: window } }),
    prisma.workflowStepInstance.count({ where: { completedAt: window } }),
    prisma.taskRejection.count({ where: { rejectedAt: window } }),
    prisma.workflowStepInstance.findMany({
      where: { completedAt: window, assignedAt: { not: null } },
      select: { assignedAt: true, completedAt: true },
    }),
    prisma.opportunity.count({ where: { createdAt: window } }),
    prisma.opportunity.count({ where: { wonAt: window } }),
    prisma.opportunity.count({ where: { lostAt: window } }),
    prisma.opportunity.aggregate({
      where: { wonAt: window },
      _sum: { estimatedValue: true },
    }),
    prisma.communication.count({
      where: { channel: "sms", direction: "outbound", createdAt: window },
    }),
    prisma.communication.count({
      where: { channel: "sms", direction: "inbound", createdAt: window },
    }),
    prisma.communication.count({
      where: { channel: "call", direction: "outbound", createdAt: window },
    }),
  ]);

  const formsByTypeMap: Record<string, number> = {};
  for (const row of formsByType) {
    formsByTypeMap[row.formType] = row._count._all;
  }

  const customersActive = activeCustomers.length;

  // Prisma returns Decimal | null for a Decimal sum; passing it straight through
  // keeps exactness, and `0` is an accepted Decimal input.
  const dealValue = wonValueAgg._sum.estimatedValue ?? 0;
  const revenue = dealValue;
  const conversionRate = dealsCreated > 0 ? (dealsWon / dealsCreated) * 100 : null;

  let avgTaskDurationMin: number | null = null;
  if (completedSteps.length > 0) {
    const totalMs = completedSteps.reduce((sum, step) => {
      if (!step.assignedAt || !step.completedAt) return sum;
      return sum + Math.max(0, step.completedAt.getTime() - step.assignedAt.getTime());
    }, 0);
    avgTaskDurationMin = Math.round(totalMs / completedSteps.length / 60_000);
  }

  const metrics = {
    customersNew,
    customersActive,
    formsSubmitted,
    formsByType: formsByTypeMap,
    tasksAssigned,
    tasksCompleted,
    tasksRejected,
    avgTaskDurationMin,
    dealsCreated,
    dealsWon,
    dealsLost,
    dealValue,
    smsSent,
    smsReceived,
    callsMade,
    revenue,
    conversionRate,
  };

  const saved = await prisma.dailyMetric.upsert({
    where: { date: storedDate },
    create: { date: storedDate, ...metrics },
    update: metrics,
  });

  console.log(`📊 DailyMetric ${toDayLabel(start)} (id=${saved.id})`);
  console.log(`   window: ${start.toISOString()} .. ${end.toISOString()} (exclusive)`);
  console.log(
    JSON.stringify(
      {
        ...metrics,
        formsByType: formsByTypeMap,
        dealValue: String(dealValue),
        revenue: String(revenue),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error("❌ crm-daily-metrics failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

