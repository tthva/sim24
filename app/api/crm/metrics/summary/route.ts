import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { z } from "zod";

// ─── GET /api/crm/metrics/summary — KPI aggregate over the range ─────
// Fast path: every counter except `customers.total` / `customers.active` is a
// SUM over the pre-computed DailyMetric rows (see scripts/crm-daily-metrics.ts
// for the exact per-column definition). `customers.active` cannot come from the
// table because DailyMetric.customersActive is a per-day DISTINCT count of
// interacting customers — summing days would double-count a customer, so it is
// answered live against Customer.lastInteractionAt instead.
const RANGE_VALUES = ["24h", "7d", "30d"] as const;
type RangeKey = (typeof RANGE_VALUES)[number];

const querySchema = z.object({
  range: z.enum(RANGE_VALUES).default("7d"),
});

const DAY_MS = 24 * 60 * 60 * 1000;

// DailyMetric is a DAILY snapshot, so "24h" is served by today's row alone —
// the finest window the pre-computed table can answer.
const RANGE_DAYS: Record<RangeKey, number> = { "24h": 1, "7d": 7, "30d": 30 };

// DailyMetric.date is `@db.Date` stored as UTC midnight of the local calendar
// day (same convention as scripts/crm-daily-metrics.ts).
function utcMidnightOfLocalDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function dayLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// formsByType is a Json? column holding `{ [formType]: count }`.
function asCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "پارامترهای جستجو نامعتبر است" } },
        { status: 400 }
      );
    }

    const rangeKey = parsed.data.range;
    const days = RANGE_DAYS[rangeKey];
    const windowEnd = utcMidnightOfLocalDay(new Date());
    const windowStart = new Date(windowEnd.getTime() - (days - 1) * DAY_MS);

    const [rows, totalCustomers, activeCustomers] = await Promise.all([
      prisma.dailyMetric.findMany({
        where: { date: { gte: windowStart, lte: windowEnd } },
        orderBy: { date: "asc" },
      }),
      // All-time customer base (no range qualifier in the spec's `total`).
      prisma.customer.count(),
      // "Active" = touched inside the window.
      prisma.customer.count({
        where: { lastInteractionAt: { gte: windowStart } },
      }),
    ]);

    let customersNew = 0;
    let formsSubmitted = 0;
    let tasksAssigned = 0;
    let tasksCompleted = 0;
    let tasksRejected = 0;
    let dealsCreated = 0;
    let dealsWon = 0;
    let dealsLost = 0;
    let smsSent = 0;
    let smsReceived = 0;
    let callsMade = 0;
    let dealValueSum = 0;
    let revenueSum = 0;
    const formsByType: Record<string, number> = {};

    // avgTaskDurationMin is stored per DAY, so the range average must be
    // duration-weighted by that day's completed tasks — otherwise a 1-task day
    // would pull the average as hard as a 50-task day.
    let durationWeightedSum = 0;
    let durationWeight = 0;
    let durationSimpleSum = 0;
    let durationSamples = 0;

    for (const row of rows) {
      customersNew += row.customersNew;
      formsSubmitted += row.formsSubmitted;
      tasksAssigned += row.tasksAssigned;
      tasksCompleted += row.tasksCompleted;
      tasksRejected += row.tasksRejected;
      dealsCreated += row.dealsCreated;
      dealsWon += row.dealsWon;
      dealsLost += row.dealsLost;
      smsSent += row.smsSent;
      smsReceived += row.smsReceived;
      callsMade += row.callsMade;
      dealValueSum += row.dealValue.toNumber();
      revenueSum += row.revenue.toNumber();

      for (const [formType, count] of Object.entries(asCountMap(row.formsByType))) {
        formsByType[formType] = (formsByType[formType] ?? 0) + count;
      }

      if (row.avgTaskDurationMin !== null) {
        durationSimpleSum += row.avgTaskDurationMin;
        durationSamples += 1;
        durationWeightedSum += row.avgTaskDurationMin * row.tasksCompleted;
        durationWeight += row.tasksCompleted;
      }
    }

    const avgDurationMin =
      durationWeight > 0
        ? Math.round(durationWeightedSum / durationWeight)
        : durationSamples > 0
          ? Math.round(durationSimpleSum / durationSamples)
          : 0;

    return NextResponse.json({
      success: true,
      data: {
        range: { key: rangeKey, days, from: dayLabel(windowStart), to: dayLabel(windowEnd) },
        customers: { total: totalCustomers, new: customersNew, active: activeCustomers },
        forms: { total: formsSubmitted, byType: formsByType },
        tasks: {
          assigned: tasksAssigned,
          completed: tasksCompleted,
          rejected: tasksRejected,
          avgDurationMin,
        },
        // totalValue is the won-deal value in the window: DailyMetric.dealValue
        // is SUM(estimatedValue) over the deals won on that day.
        pipeline: { dealsCreated, dealsWon, dealsLost, totalValue: dealValueSum },
        communication: { smsSent, smsReceived, callsMade },
        // revenue is intentionally identical to pipeline.totalValue — the
        // snapshot script keeps them as separate columns so a future accounting
        // source can diverge without changing this contract.
        revenue: { total: revenueSum, currency: "IRR" },
      },
    });
  } catch (error) {
    console.error("[CRM] metrics summary failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
