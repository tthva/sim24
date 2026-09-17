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
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 20)));
    const skip = (page - 1) * limit;

    const status = url.searchParams.get("status") ?? undefined;
    const formType = url.searchParams.get("formType") ?? undefined;

    // date filter: createdAt range
    const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
    const dateTo = url.searchParams.get("dateTo") ?? undefined;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (formType) {
      // WorkflowInstance has `metadata: Json?` but there is no typed Prisma JSON filter
      // for arbitrary paths across all Prisma versions.
      // Best-effort: only return instances that already store formType under metadata.
      // If your metadata schema differs, this filter may be ineffective.
      where.metadata = {
        equals: { formType },
      } as any;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const total = await prisma.workflowInstance.count({ where });

    const instances = await prisma.workflowInstance.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        status: true,
        currentStepOrder: true,
        dueAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        agentId: true,
        customerFormId: true,
        versionId: true,
        metadata: true,
        version: {
          select: {
            workflow: { select: { code: true, title: true, department: true } },
          },
        },
        stepInstances: {
          include: {
            step: true,
            assignedTo: { select: { id: true, username: true, fullName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({
      items: instances.map((i) => ({
        id: i.id,
        status: i.status,
        currentStepOrder: i.currentStepOrder,
        dueAt: i.dueAt,
        completedAt: i.completedAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        agentId: i.agentId,
        customerFormId: i.customerFormId,
        metadata: i.metadata,
        workflowCode: i.version?.workflow?.code ?? null,
        workflowTitle: i.version?.workflow?.title ?? null,
        workflowDepartment: i.version?.workflow?.department ?? null,
        stepInstances: i.stepInstances.map((si) => ({
          id: si.id,
          status: si.status,
          stepOrder: si.step?.stepOrder ?? null,
          stepCode: si.step?.code ?? null,
          stepTitle: si.step?.title ?? null,
          stepDepartment: si.step?.department ?? null,
          assignedTo: si.assignedTo
            ? { id: si.assignedTo.id, username: si.assignedTo.username, fullName: si.assignedTo.fullName }
            : null,
          assignedAt: si.assignedAt,
          startedAt: si.startedAt,
          completedAt: si.completedAt,
          dueAt: si.dueAt,
        })),
      })),
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
