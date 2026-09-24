import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { z } from "zod";

const querySchema = z.object({
  pipelineId: z.string().optional(),
});

// ─── GET /api/crm/reports/pipeline ─────
// Analytics: deals per stage, total value per stage, conversion rate,
// average time per stage (avg hours from createdAt to wonAt/lostAt).
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "پارامترها نامعتبر است" } },
        { status: 400 }
      );
    }

    // Resolve pipeline (default if not specified)
    const pipeline = parsed.data.pipelineId
      ? await prisma.pipeline.findUnique({ where: { id: parsed.data.pipelineId }, include: { stages: { orderBy: { order: "asc" } } } })
      : await prisma.pipeline.findFirst({ where: { isDefault: true }, include: { stages: { orderBy: { order: "asc" } } } });

    if (!pipeline) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پایپ‌لاین یافت نشد" } },
        { status: 404 }
      );
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { pipelineId: pipeline.id },
      select: {
        stageId: true,
        estimatedValue: true,
        wonAt: true,
        lostAt: true,
        createdAt: true,
      },
    });

    const stagesReport = pipeline.stages.map((stage) => {
      const deals = opportunities.filter((o) => o.stageId === stage.id);
      const totalValue = deals.reduce((sum, o) => sum + Number(o.estimatedValue ?? 0), 0);
      return {
        stageId: stage.id,
        code: stage.code,
        name: stage.name,
        color: stage.color,
        isWon: stage.isWon,
        isLost: stage.isLost,
        deals: deals.length,
        totalValue,
      };
    });

    // ── conversion rate: won / (won + lost) closed deals ──
    const won = opportunities.filter((o) => o.wonAt).length;
    const lost = opportunities.filter((o) => o.lostAt).length;
    const conversionRate = won + lost > 0
      ? Math.round((won / (won + lost)) * 1000) / 10
      : 0;

    // ── avg time to close (won + lost), hours ──
    const closed = opportunities.filter((o) => o.wonAt || o.lostAt);
    const closeHours = closed.map((o) => {
      const end = (o.wonAt ?? o.lostAt) as Date;
      return (end.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60);
    });
    const avgHoursToClose = closeHours.length > 0
      ? Math.round((closeHours.reduce((a, b) => a + b, 0) / closeHours.length) * 10) / 10
      : 0;

    // ── avg time per stage for closed deals (proxy: creation → end attributed to their stage) ──
    const avgTimePerStage = pipeline.stages.map((stage) => {
      const stageClosed = closed.filter((o) => o.stageId === stage.id);
      const hours = stageClosed.map((o) => {
        const end = (o.wonAt ?? o.lostAt) as Date;
        return (end.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60);
      });
      return {
        stageId: stage.id,
        code: stage.code,
        name: stage.name,
        avgHours: hours.length > 0
          ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
          : 0,
        closedCount: stageClosed.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        pipeline: { id: pipeline.id, name: pipeline.name },
        stages: stagesReport,
        totals: {
          deals: opportunities.length,
          won,
          lost,
          open: opportunities.length - won - lost,
          conversionRate,
          avgHoursToClose,
        },
        avgTimePerStage,
      },
    });
  } catch (error) {
    console.error("[CRM] pipeline report failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
