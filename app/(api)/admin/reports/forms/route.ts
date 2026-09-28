import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { Prisma } from "@prisma/client";

// ---- Types ----

interface DailyFormTypeRow {
  formType: string;
  day: string;
  count: number;
  started: number;
}

interface FormTypeBreakdown {
  formType: string;
  count: number;
  started: number;
  conversionRate: number;
}

interface DailyCount {
  day: string;
  count: number;
}

interface FormReport {
  summary: {
    total: number;
    started: number;
    conversionRate: number;
    formTypes: number;
  };
  byFormType: FormTypeBreakdown[];
  daily: DailyCount[];
  items: DailyFormTypeRow[];
}

function buildCsv(report: FormReport): string {
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [];

  // Summary section
  lines.push("section,key,value");
  lines.push(`summary,Total Forms,${report.summary.total}`);
  lines.push(`summary,Workflow Started,${report.summary.started}`);
  lines.push(`summary,Conversion Rate,${(report.summary.conversionRate * 100).toFixed(1)}%`);
  lines.push(`summary,Distinct Form Types,${report.summary.formTypes}`);

  // Per-formType breakdown
  lines.push("");
  lines.push("formType,total,workflowStarted,conversionRate");
  for (const ft of report.byFormType) {
    lines.push(
      [esc(ft.formType), ft.count, ft.started, `${(ft.conversionRate * 100).toFixed(1)}%`].join(",")
    );
  }

  // Daily series
  lines.push("");
  lines.push("day,totalForms");
  for (const d of report.daily) {
    lines.push([d.day, d.count].join(","));
  }

  // Detailed formType x day rows
  lines.push("");
  lines.push("formType,day,count,workflowStarted");
  for (const it of report.items) {
    lines.push([it.formType, it.day, it.count, it.started].join(","));
  }

  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const url = new URL(req.url);
    const formType = url.searchParams.get("formType") ?? undefined;
    const dateFromStr = url.searchParams.get("dateFrom") ?? undefined;
    const dateToStr = url.searchParams.get("dateTo") ?? undefined;
    const format = url.searchParams.get("format") ?? undefined;

    const where: any = {};

    if (formType) {
      // Prefix-friendly match, consistent with /api/admin/forms.
      where.formType = { contains: formType };
    }

    if (dateFromStr || dateToStr) {
      where.createdAt = {};
      if (dateFromStr) where.createdAt.gte = new Date(dateFromStr);
      if (dateToStr) where.createdAt.lte = new Date(dateToStr);
    }

    // Raw-SQL WHERE fragment mirroring the Prisma `where` above (the two raw
    // aggregation queries cannot take a Prisma where object). All user input
    // is parameterized — no string interpolation of values.
    const whereSql =
      formType && dateFromStr && dateToStr
        ? Prisma.sql`WHERE "formType" LIKE ${`%${formType}%`} AND "createdAt" >= ${new Date(dateFromStr)} AND "createdAt" <= ${new Date(dateToStr)}`
        : formType && dateFromStr
          ? Prisma.sql`WHERE "formType" LIKE ${`%${formType}%`} AND "createdAt" >= ${new Date(dateFromStr)}`
          : formType && dateToStr
            ? Prisma.sql`WHERE "formType" LIKE ${`%${formType}%`} AND "createdAt" <= ${new Date(dateToStr)}`
            : formType
              ? Prisma.sql`WHERE "formType" LIKE ${`%${formType}%`}`
              : dateFromStr && dateToStr
                ? Prisma.sql`WHERE "createdAt" >= ${new Date(dateFromStr)} AND "createdAt" <= ${new Date(dateToStr)}`
                : dateFromStr
                  ? Prisma.sql`WHERE "createdAt" >= ${new Date(dateFromStr)}`
                  : dateToStr
                    ? Prisma.sql`WHERE "createdAt" <= ${new Date(dateToStr)}`
                    : Prisma.sql``;

    // ── DB-side aggregation (no full-table scan into JS memory) ──
    // Day bucketing uses to_char(createdAt AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    // so grouping happens in Postgres; totals/per-type are two groupBy queries.
    // Prisma has no date-trunc groupBy, so raw SQL is the honest tool here.
    const dayExpr = Prisma.sql`to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

    const [itemsRaw, perTypeRaw, totalAgg] = await Promise.all([
      prisma.$queryRaw<{ formType: string; day: string; count: bigint; started: bigint }[]>(
        Prisma.sql`
          SELECT "formType"          AS "formType",
                 ${dayExpr}           AS day,
                 count(*)::bigint     AS count,
                 count(*) FILTER (WHERE "workflowStarted")::bigint AS started
          FROM "customer_forms"
          ${whereSql}
          GROUP BY 1, 2
          ORDER BY 2 ASC, 1 ASC
        `
      ),
      prisma.$queryRaw<{ formType: string; count: bigint; started: bigint }[]>(
        Prisma.sql`
          SELECT "formType"      AS "formType",
                 count(*)::bigint AS count,
                 count(*) FILTER (WHERE "workflowStarted")::bigint AS started
          FROM "customer_forms"
          ${whereSql}
          GROUP BY 1
          ORDER BY 3 DESC
        `
      ),
      prisma.customerForm.aggregate({
        where: where as never,
        _count: { _all: true, workflowStarted: true },
      }),
    ]);

    // ---- Assemble report from aggregated rows ----
    const items: DailyFormTypeRow[] = itemsRaw.map((r) => ({
      formType: r.formType,
      day: r.day,
      count: Number(r.count),
      started: Number(r.started),
    }));

    const byFormType: FormTypeBreakdown[] = perTypeRaw.map((r) => ({
      formType: r.formType,
      count: Number(r.count),
      started: Number(r.started),
      conversionRate: Number(r.count) > 0 ? Number(r.started) / Number(r.count) : 0,
    }));

    const dailyMap = new Map<string, number>();
    for (const it of items) {
      dailyMap.set(it.day, (dailyMap.get(it.day) ?? 0) + it.count);
    }
    const daily: DailyCount[] = [...dailyMap.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const total = Number(totalAgg._count._all);
    const totalStarted = Number(totalAgg._count.workflowStarted);

    const report: FormReport = {
      summary: {
        total,
        started: totalStarted,
        conversionRate: total > 0 ? totalStarted / total : 0,
        formTypes: byFormType.length,
      },
      byFormType,
      daily,
      items,
    };

    // ---- CSV export ----
    if (format === "csv") {
      const csv = buildCsv(report);
      return new NextResponse("\uFEFF" + csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="forms-report-${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      items,
      summary: report.summary,
      byFormType,
      daily,
      meta: {
        formType: formType ?? null,
        dateFrom: dateFromStr ?? null,
        dateTo: dateToStr ?? null,
      },
    });
  } catch {
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}


