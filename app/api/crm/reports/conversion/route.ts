import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { z } from "zod";

// ─── GET /api/crm/reports/conversion — sales funnel ─────
// Counts opportunities by their CURRENT stage and derives the stage-to-stage
// rates from those counts (no historical stage-transition table exists).
//
// Query params:
//   from/to  optional ISO date range filtering Opportunity.createdAt (the
//            funnel entry date). Omit both to report over every opportunity.
const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// Canonical funnel of the default pipeline (see scripts/crm-phase3-seed.ts).
// The array order IS the funnel order — do not reorder.
const FUNNEL_STAGES = [
  { code: "lead", name: "سرنخ" },
  { code: "contacted", name: "تماس گرفته" },
  { code: "qualified", name: "واجد شرایط" },
  { code: "negotiation", name: "مذاکره" },
  { code: "won", name: "برنده" },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? round4(numerator / denominator) : 0;
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
    const { from, to } = parsed.data;

    const where =
      from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {};

    const opportunities = await prisma.opportunity.findMany({
      where,
      select: {
        estimatedValue: true,
        wonAt: true,
        createdAt: true,
        stage: { select: { code: true, name: true, isWon: true, isLost: true } },
      },
    });

    const countByCode = new Map<string, number>();
    const nameByCode = new Map<string, string>();
    for (const o of opportunities) {
      countByCode.set(o.stage.code, (countByCode.get(o.stage.code) ?? 0) + 1);
      if (!nameByCode.has(o.stage.code)) nameByCode.set(o.stage.code, o.stage.name);
    }

    // DB name wins (single source of truth); the seed name is the fallback for
    // a missing stage row.
    const stages = FUNNEL_STAGES.map((s) => ({
      name: nameByCode.get(s.code) ?? s.name,
      code: s.code,
      count: countByCode.get(s.code) ?? 0,
    }));

    const transitions = stages.slice(0, -1).map((stage, i) => ({
      from: stage.code,
      to: stages[i + 1].code,
      rate: ratio(stages[i + 1].count, stage.count),
    }));

    const leadCount = stages[0].count;
    const wonCount = stages[stages.length - 1].count;

    // Won deals: PipelineStage.isWon is the source of truth; the code check also
    // covers a pipeline whose win stage carries a different code.
    const won = opportunities.filter((o) => o.stage.isWon || o.stage.code === "won");
    const totalValue = won.reduce(
      (sum, o) => sum + (o.estimatedValue === null ? 0 : o.estimatedValue.toNumber()),
      0
    );

    const winDays: number[] = [];
    for (const o of won) {
      if (!o.wonAt) continue;
      winDays.push((o.wonAt.getTime() - o.createdAt.getTime()) / DAY_MS);
    }
    const avgTimeToWinDays =
      winDays.length > 0
        ? round1(winDays.reduce((a, b) => a + b, 0) / winDays.length)
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        stages,
        transitions,
        overallConversion: ratio(wonCount, leadCount),
        totalValue,
        // estimatedValue is Decimal(15,0) — IRR has no minor unit, so the mean
        // is rounded to whole Rial.
        avgDealSize: wonCount > 0 ? Math.round(totalValue / wonCount) : 0,
        avgTimeToWinDays,
      },
    });
  } catch (error) {
    console.error("[CRM] conversion report failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
