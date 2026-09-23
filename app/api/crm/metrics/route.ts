import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { z } from "zod";

// ─── GET /api/crm/metrics — daily snapshot range ─────
// Read-only reporting over the PRE-COMPUTED DailyMetric rows
// (written by scripts/crm-daily-metrics.ts).
//
// Days with no snapshot row are skipped on purpose: this endpoint never
// recomputes metrics on the fly, because a locally recomputed window would
// silently disagree with the snapshot the dashboards already trust.
//
// Query params:
//   from/to  optional ISO date or timestamp (z.coerce.date, same convention as
//            app/api/crm/automation/logs/route.ts). `to` is inclusive.
//   days     alternative window length: the last N calendar days INCLUDING
//            today (days=7 → today-6..today). Used when `from` is omitted.
const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

// DailyMetric.date is `@db.Date` and is stored as UTC midnight of the local
// calendar day (see the header of scripts/crm-daily-metrics.ts). Bounding the
// query with the same convention avoids the one-day drift a raw local
// `new Date(...)` comparison would introduce for timezones ahead of UTC
// (this deployment runs +03:30).
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
    const { from, to, days } = parsed.data;

    // Resolve the window. `to` defaults to today; when `to` is supplied without
    // `from`, the window length falls back to `days` / the 30-day default.
    const today = utcMidnightOfLocalDay(new Date());
    const windowEnd = to ? utcMidnightOfLocalDay(to) : today;
    const windowDays = days ?? DEFAULT_WINDOW_DAYS;
    const windowStart = from
      ? utcMidnightOfLocalDay(from)
      : new Date(windowEnd.getTime() - (windowDays - 1) * DAY_MS);

    if (windowStart.getTime() > windowEnd.getTime()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_RANGE", message: "بازه تاریخ نامعتبر است" } },
        { status: 400 }
      );
    }

    const rows = await prisma.dailyMetric.findMany({
      where: { date: { gte: windowStart, lte: windowEnd } },
      orderBy: { date: "asc" },
    });

    // Decimal (dealValue/revenue) → number before it reaches the JSON envelope;
    // formsByType Json → plain count map; date → "YYYY-MM-DD".
    const metrics = rows.map((row) => ({
      id: row.id,
      date: dayLabel(row.date),
      customersNew: row.customersNew,
      customersActive: row.customersActive,
      formsSubmitted: row.formsSubmitted,
      formsByType: asCountMap(row.formsByType),
      tasksAssigned: row.tasksAssigned,
      tasksCompleted: row.tasksCompleted,
      tasksRejected: row.tasksRejected,
      avgTaskDurationMin: row.avgTaskDurationMin,
      dealsCreated: row.dealsCreated,
      dealsWon: row.dealsWon,
      dealsLost: row.dealsLost,
      dealValue: row.dealValue.toNumber(),
      smsSent: row.smsSent,
      smsReceived: row.smsReceived,
      callsMade: row.callsMade,
      revenue: row.revenue.toNumber(),
      conversionRate: row.conversionRate,
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    console.error("[CRM] metrics range failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
