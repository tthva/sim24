import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { z } from "zod";

// ─── GET /api/crm/reports/forecast — weighted pipeline forecast ─────
// Weighted value = estimatedValue × (probability ?? 30) / 100 for every OPEN
// opportunity whose expectedCloseAt falls inside the horizon window.
//
// Query params:
//   horizon  forecast window in days, counted from NOW. The spec calls out
//            30 | 60 | 90; any 1..365 value is accepted so callers are not
//            limited to three fixed windows.
const querySchema = z.object({
  horizon: z.coerce.number().int().min(1).max(365).default(30),
});

const DAY_MS = 24 * 60 * 60 * 1000;

// Opportunity.probability is nullable; 30% is the documented neutral fallback.
const DEFAULT_PROBABILITY = 30;

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
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
    const { horizon } = parsed.data;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + horizon * DAY_MS);

    // stage.isWon / stage.isLost are the only open/closed flags on the pipeline
    // (Opportunity itself has just the wonAt / lostAt timestamps).
    const opportunities = await prisma.opportunity.findMany({
      where: {
        expectedCloseAt: { gte: now, lte: windowEnd },
        stage: { isWon: false, isLost: false },
      },
      select: {
        estimatedValue: true,
        probability: true,
        stage: { select: { code: true, name: true, order: true } },
      },
    });

    let expectedRevenue = 0;
    let probabilitySum = 0;
    const stageMap = new Map<
      string,
      { code: string; name: string; order: number; count: number; weightedValue: number }
    >();

    for (const o of opportunities) {
      const value = o.estimatedValue === null ? 0 : o.estimatedValue.toNumber();
      const probability = o.probability ?? DEFAULT_PROBABILITY;
      const weightedValue = (value * probability) / 100;

      expectedRevenue += weightedValue;
      probabilitySum += probability;

      const entry = stageMap.get(o.stage.code) ?? {
        code: o.stage.code,
        name: o.stage.name,
        order: o.stage.order,
        count: 0,
        weightedValue: 0,
      };
      entry.count += 1;
      entry.weightedValue += weightedValue;
      stageMap.set(o.stage.code, entry);
    }

    // Funnel order (PipelineStage.order) keeps the breakdown deterministic.
    const byStage = [...stageMap.values()]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        code: s.code,
        name: s.name,
        count: s.count,
        weightedValue: Math.round(s.weightedValue),
      }));

    // Naive confidence = mean win probability of the in-window deals, clamped to
    // [0,1]. Later stages carry a higher Opportunity.probability, so a
    // negotiation-heavy forecast scores higher than a lead-heavy one — and an
    // empty forecast scores 0.
    const avgProbability =
      opportunities.length > 0 ? probabilitySum / opportunities.length : 0;
    const confidence =
      Math.round(Math.min(1, Math.max(0, avgProbability / 100)) * 100) / 100;

    return NextResponse.json({
      success: true,
      data: {
        horizon,
        // Decimal(15,0) — IRR has no minor unit, so money is whole Rial.
        expectedRevenue: Math.round(expectedRevenue),
        opportunities: opportunities.length,
        byStage,
        confidence,
      },
    });
  } catch (error) {
    console.error("[CRM] forecast report failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
