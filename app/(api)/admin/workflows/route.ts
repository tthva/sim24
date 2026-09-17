import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

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
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const skip = (page - 1) * limit;

    const total = await prisma.workflow.count();

    const workflows = await prisma.workflow.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        department: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      items: workflows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
