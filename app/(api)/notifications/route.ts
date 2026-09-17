import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["agent"]);
    if (auth.response) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { agentProfile: true },
    });

    const agentId = user?.agentProfile?.id;
    if (!agentId) return NextResponse.json({ message: "یافت نشد" }, { status: 404 });

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const skip = (page - 1) * limit;

    const total = await (prisma as any).notification.count({ where: { agentId } });
    const items = await (prisma as any).notification.findMany({
      where: { agentId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: { id: true, title: true, body: true, read: true, link: true, createdAt: true },
    });

    const unreadCount = await (prisma as any).notification.count({ where: { agentId, read: false } });

    return NextResponse.json({
      items,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch {
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}