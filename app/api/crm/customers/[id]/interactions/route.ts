import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/crm/customers/[id]/interactions — timeline ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const limit = Math.min(100, Number(sp.get("limit") || 50));

    const interactions = await prisma.customerInteraction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, data: interactions });
  } catch (error) {
    console.error("[CRM] listInteractions failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
