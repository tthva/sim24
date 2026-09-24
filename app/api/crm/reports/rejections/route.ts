import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { z } from "zod";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// ─── GET /api/crm/reports/rejections ─────
// Analytics: count by reason, count by category, 30-day time series, rejection rate.
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
    const days = parsed.data.days;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // TaskRejections in the window
    const taskRejections = await prisma.taskRejection.findMany({
      where: { rejectedAt: { gte: since } },
      include: { reason: { select: { id: true, code: true, name: true, category: true } } },
    });

    // Opportunity rejections in the window (lost with a reason)
    const oppRejections = await prisma.opportunity.findMany({
      where: {
        lostAt: { gte: since },
        rejectionReasonId: { not: null },
      },
      select: { id: true, lostAt: true, rejectionReason: { select: { code: true, name: true, category: true } } },
    });

    // ── count by reason (task + opportunity merged) ──
    const byReasonMap = new Map<string, { name: string; category: string | null; count: number }>();
    const bump = (code: string, name: string, category: string | null) => {
      const cur = byReasonMap.get(code) ?? { name, category, count: 0 };
      cur.count += 1;
      byReasonMap.set(code, cur);
    };
    for (const tr of taskRejections) bump(tr.reason.code, tr.reason.name, tr.reason.category);
    for (const o of oppRejections) {
      if (o.rejectionReason) bump(o.rejectionReason.code, o.rejectionReason.name, o.rejectionReason.category);
    }
    const byReason = [...byReasonMap.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.count - a.count);

    // ── count by category ──
    const byCategoryMap = new Map<string, number>();
    for (const r of byReason) {
      const cat = r.category ?? "other";
      byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + r.count);
    }
    const byCategory = [...byCategoryMap.entries()].map(([category, count]) => ({ category, count }));

    // ── time series (last N days) ──
    const series: { date: string; count: number }[] = [];
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      series.push({ date: dayKey(dayStart), count: 0 });
    }
    const indexByDate = new Map(series.map((s, i) => [s.date, i]));
    const bumpDay = (d: Date | null) => {
      if (!d) return;
      const idx = indexByDate.get(dayKey(d));
      if (idx !== undefined) series[idx].count += 1;
    };
    for (const tr of taskRejections) bumpDay(tr.rejectedAt);
    for (const o of oppRejections) bumpDay(o.lostAt);

    // ── rejection rate: rejections / (completions + rejections) over window ──
    const completedSteps = await prisma.workflowStepInstance.count({
      where: { status: "COMPLETED", completedAt: { gte: since } },
    });
    const totalRejections = taskRejections.length;
    const rejectionRate = completedSteps + totalRejections > 0
      ? Math.round((totalRejections / (completedSteps + totalRejections)) * 1000) / 10
      : 0;

    // ── recent table (latest 20) ──
    const recent = await prisma.taskRejection.findMany({
      orderBy: { rejectedAt: "desc" },
      take: 20,
      include: {
        reason: { select: { code: true, name: true, category: true } },
        rejectedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        window: { days, since },
        totalRejections: totalRejections + oppRejections.length,
        completedSteps,
        rejectionRate,
        byReason,
        byCategory,
        series,
        recent,
      },
    });
  } catch (error) {
    console.error("[CRM] rejection report failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
