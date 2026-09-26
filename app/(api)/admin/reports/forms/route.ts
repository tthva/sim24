import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

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

    // Single server-side query; aggregations computed from the selected rows.
    const rows = await prisma.customerForm.findMany({
      where,
      select: {
        formType: true,
        createdAt: true,
        workflowStarted: true,
      },
    });

    // ---- Server-side aggregations ----
    const byKey = new Map<string, DailyFormTypeRow>();

    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const key = `${r.formType}::${day}`;
      const entry = byKey.get(key) ?? {
        formType: r.formType,
        day,
        count: 0,
        started: 0,
      };
      entry.count += 1;
      if (r.workflowStarted) entry.started += 1;
      byKey.set(key, entry);
    }

    const items = [...byKey.values()].sort((a, b) =>
      a.day === b.day
        ? a.formType.localeCompare(b.formType)
        : a.day.localeCompare(b.day)
    );

    // Per-formType breakdown + conversion (workflowStarted) metrics.
    const perType = new Map<string, { count: number; started: number }>();
    for (const it of items) {
      const agg = perType.get(it.formType) ?? { count: 0, started: 0 };
      agg.count += it.count;
      agg.started += it.started;
      perType.set(it.formType, agg);
    }

    const byFormType: FormTypeBreakdown[] = [...perType.entries()]
      .map(([formType, agg]) => ({
        formType,
        count: agg.count,
        started: agg.started,
        conversionRate: agg.count > 0 ? agg.started / agg.count : 0,
      }))
      .sort((a, b) => b.count - a.count);

    let totalStarted = 0;
    for (const agg of perType.values()) totalStarted += agg.started;

    const dailyMap = new Map<string, number>();
    for (const it of items) {
      dailyMap.set(it.day, (dailyMap.get(it.day) ?? 0) + it.count);
    }
    const daily = [...dailyMap.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const report: FormReport = {
      summary: {
        total: rows.length,
        started: totalStarted,
        conversionRate: rows.length > 0 ? totalStarted / rows.length : 0,
        formTypes: perType.size,
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


