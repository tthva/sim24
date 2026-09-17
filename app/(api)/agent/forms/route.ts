import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    // Phase 4: Migrated to requireRole
    const auth = await requireRole(request, ["agent"]);
    if (auth.response) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { agentProfile: true },
    });

    const agentId = user?.agentProfile?.id;
    if (!agentId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("formType");
    const phone = searchParams.get("phone");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { agentId };

    if (formType) where.formType = { contains: formType };
    if (phone) where.phone = { contains: phone };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const forms = await prisma.customerForm.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ forms });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}