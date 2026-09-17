import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

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

    // date range (createdAt)
    const dateFromStr = url.searchParams.get("dateFrom") ?? undefined;
    const dateToStr = url.searchParams.get("dateTo") ?? undefined;

    const where: any = {};

    if (formType) {
      where.formType = formType;
    }

    if (dateFromStr || dateToStr) {
      where.createdAt = {};
      if (dateFromStr) where.createdAt.gte = new Date(dateFromStr);
      if (dateToStr) where.createdAt.lte = new Date(dateToStr);
    }

    // Use the JSON formType field? Here we use the relational column formType on CustomerForm.
    const rows = await prisma.customerForm.findMany({
      where,
      select: {
        formType: true,
        createdAt: true,
      },
    });

    // Group counts by formType + day (YYYY-MM-DD)
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      const key = `${r.formType}::${day}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const items = Object.entries(counts)
      .map(([key, count]) => {
        const [ft, day] = key.split("::");
        return { formType: ft, day, count };
      })
      .sort((a, b) => {
        if (a.day === b.day) return a.formType.localeCompare(b.formType);
        return a.day.localeCompare(b.day);
      });

    return NextResponse.json({
      items,
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
