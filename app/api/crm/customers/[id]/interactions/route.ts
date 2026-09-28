import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { canViewCustomerData } from "@/lib/crm/scope";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/crm/customers/[id]/interactions — timeline ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;

    // Read-IDOR fix (D-OWNERSHIP): mirror the customer detail/timeline owner
    // scope — previously ANY crm.read user could read any customer's full
    // interaction history by id.
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { referralAgentId: true },
    });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    if (!(await canViewCustomerData(auth.user.sub, customer.referralAgentId))) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "دسترسی غیر مجاز" } },
        { status: 403 }
      );
    }

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
