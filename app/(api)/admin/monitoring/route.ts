import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { formatFaDateTime } from "@/lib/date-fa";

const ACTIVE_STEP_STATUSES = ["ASSIGNED", "IN_PROGRESS"];
const DEPARTMENTS = ["PRICE", "PRODUCT", "SELL", "INVESTMENT"] as const;
const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin"]);
  if (auth.response) return auth.response;

  try {
    // ─── Filters ───
    const sp = request.nextUrl.searchParams;
    const range = RANGE_MS[sp.get("range") ?? ""] ? (sp.get("range") as string) : "24h";
    const department = DEPARTMENTS.includes((sp.get("department") ?? "") as any)
      ? (sp.get("department") as string)
      : null;
    const status = ["ASSIGNED", "IN_PROGRESS"].includes(sp.get("status") ?? "")
      ? (sp.get("status") as string)
      : null;
    const rangeStart = new Date(Date.now() - RANGE_MS[range]);
    const stepWhere: any = {
      status: status ? { in: [status] } : { in: ACTIVE_STEP_STATUSES },
      ...(department ? { step: { department } } : {}),
    };

    // ─── KPI counts (parallel) ───
    const [
      totalForms,
      totalWorkflows,
      activeWorkflowCount,
      pendingTasks,
      completedInRange,
      newFormsInRange,
      overdueCount,
      nearDueCount,
    ] = await Promise.all([
      prisma.customerForm.count({}),
      prisma.workflowInstance.count({}),
      prisma.workflowInstance.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      prisma.workflowStepInstance.count({ where: { status: "ASSIGNED" } }),
      prisma.workflowStepInstance.count({ where: { status: "COMPLETED", completedAt: { gte: rangeStart } } }),
      prisma.customerForm.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.workflowStepInstance.count({
        where: { ...stepWhere, status: { in: ACTIVE_STEP_STATUSES }, dueAt: { lt: new Date() } },
      }),
      prisma.workflowStepInstance.count({
        where: { ...stepWhere, dueAt: { gte: new Date(), lte: new Date(Date.now() + 60 * 60 * 1000) } },
      }),
    ]);

    // ─── Chart 1: forms per day (fixed last 7 days) ───
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const formDates = await prisma.customerForm.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: { createdAt: true },
    });
    const dayKey = (d: Date) => d.toLocaleDateString("fa-IR", { month: "2-digit", day: "2-digit" });
    const formsPerDay: Array<{ day: string; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = dayKey(day);
      formsPerDay.push({
        day: key,
        count: formDates.filter((f) => dayKey(f.createdAt) === key).length,
      });
    }

    // ─── Chart 2: active tasks by department ───
    const tasksByDepartment = await Promise.all(
      DEPARTMENTS.map((dept) =>
        prisma.workflowStepInstance
          .count({ where: { status: { in: ACTIVE_STEP_STATUSES as any[] }, step: { department: dept as any } } })
          .then((count) => ({ dept, count })),
      ),
    );

    // ─── Chart 3: task status breakdown (department filter applies) ───
    const taskStatusBreakdown = await Promise.all(
      ["ASSIGNED", "IN_PROGRESS", "COMPLETED"].map((st) =>
        prisma.workflowStepInstance
          .count({
            where: { status: st as any, ...(department ? { step: { department: department as any } } : {}) },
          })
          .then((count) => ({ status: st, count })),
      ),
    );

    // ─── SLA lists (overdue + near due) ───
    const slaInclude = {
      step: true,
      assignedTo: { select: { username: true, fullName: true } },
      instance: {
        select: { version: { select: { workflow: { select: { code: true, title: true } } } } },
      },
    };
    const slaMap = (si: any) => ({
      id: si.id,
      workflowCode: si.instance?.version?.workflow?.code ?? null,
      workflowTitle: si.instance?.version?.workflow?.title ?? null,
      stepName: si.step?.title ?? null,
      department: si.step?.department ?? null,
      operator: si.assignedTo?.fullName || si.assignedTo?.username || null,
      status: si.status,
      dueAt: si.dueAt,
      dueAtFa: si.dueAt ? formatFaDateTime(new Date(si.dueAt)) : null,
    });

    const [overdueRaw, nearDueRaw] = await Promise.all([
      prisma.workflowStepInstance.findMany({
        where: { ...stepWhere, dueAt: { lt: new Date() } },
        orderBy: { dueAt: "asc" },
        take: 10,
        include: slaInclude,
      }),
      prisma.workflowStepInstance.findMany({
        where: { ...stepWhere, dueAt: { gte: new Date(), lte: new Date(Date.now() + 60 * 60 * 1000) } },
        orderBy: { dueAt: "asc" },
        take: 10,
        include: slaInclude,
      }),
    ]);

    // ─── Active workflows (existing + filters) ───
    const activeWorkflows: any[] = await prisma.workflowInstance.findMany({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] as any[] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        version: { select: { workflow: { select: { code: true, title: true } } } },
        stepInstances: {
          where: ({
            status: status ? { in: [status] } : { in: ACTIVE_STEP_STATUSES },
            ...(department ? { step: { department } } : {}),
          } as any),
          orderBy: { createdAt: "asc" },
          take: 1,
          include: { step: true, assignedTo: { select: { username: true } } },
        },
      } as any,
    });

    const activeWorkflowsData = activeWorkflows
      .map((w) => {
        const currentStep = w.stepInstances[0];
        return {
          id: w.id,
          workflowCode: w.version?.workflow?.code ?? null,
          workflowTitle: w.version?.workflow?.title ?? null,
          status: w.status,
          currentStepOrder: w.currentStepOrder,
          currentStepName: currentStep?.step?.title ?? null,
          currentStepDepartment: currentStep?.step?.department ?? null,
          assignedOperator: currentStep?.assignedTo?.username ?? null,
          stepStatus: currentStep?.status ?? null,
          dueAt: currentStep?.dueAt ?? null,
          createdAt: w.createdAt,
        };
      })
      .filter((w) => w.currentStepName !== null);

    // ─── Latest forms ───
    const latestForms = await prisma.customerForm.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        workflowCode: true,
        workflowStarted: true,
        createdAt: true,
        metadata: true,
      },
    });

    const formsWithFaDate = latestForms.map((f) => ({
      id: f.id,
      fullName: f.fullName,
      workflowCode: f.workflowCode,
      workflowStarted: f.workflowStarted,
      createdAt: f.createdAt,
      createdAtFa: (f.metadata as any)?.createdAtFa ?? formatFaDateTime(f.createdAt),
    }));

    return NextResponse.json({
      success: true,
      data: {
        filters: { range, department, status },
        totalForms,
        totalWorkflows,
        activeWorkflowCount,
        pendingTasks,
        completedToday: completedInRange,
        newFormsToday: newFormsInRange,
        overdueCount,
        nearDueCount,
        formsPerDay,
        tasksByDepartment,
        tasksByStatus: taskStatusBreakdown,
        overdueTasks: overdueRaw.map(slaMap),
        nearDueTasks: nearDueRaw.map(slaMap),
        latestForms: formsWithFaDate,
        activeWorkflows: activeWorkflowsData,
      },
    });
  } catch (error) {
    console.error("Admin monitoring API error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در دریافت آمار" },
      { status: 500 }
    );
  }
}