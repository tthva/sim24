import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (payload.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const formType = searchParams.get("formType");
    const phone = searchParams.get("phone");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const agentId = searchParams.get("agentId");

    const where: any = {};

    if (formType) where.formType = { contains: formType };
    if (phone) where.phone = { contains: phone };
    if (agentId) where.agentId = agentId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const forms = await prisma.customerForm.findMany({
      where,
      include: {
        agent: { include: { user: { select: { id: true, username: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      forms: forms.map((f) => ({
        id: f.id,
        phone: f.phone,
        fullName: f.fullName,
        formType: f.formType,
        formData: f.formData,
        workflowCode: f.workflowCode,
        workflowStarted: f.workflowStarted,
        createdAt: f.createdAt,
        agent: f.agent ? { id: f.agent.id, username: f.agent.user?.username } : null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}