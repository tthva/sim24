import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { getUserAgentId } from "@/lib/crm/scope";

// ─── GET /api/crm/my-dashboard — personal KPIs for the signed-in user ─────
// Phase 4.8d-1: everything is scoped to the CALLER — customers via their
// Agent profile (Customer.referralAgentId = Agent.id), workflow tasks and
// opportunities via assignedToId = User.id. The global view stays at
// /api/crm/stats; both crm_operator and crm_manager use this endpoint and
// each sees only their own rows (fail-closed: no Agent profile ⇒ 0 customers).
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;
    const userId = auth.user.sub;

    const agentId = await getUserAgentId(userId);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      myCustomers,
      myTasks,
      myTasksCompletedToday,
      myOpportunities,
      avgScore,
      myTasksToday,
      myCustomersRecent,
      myOpportunitiesTop,
    ] = await Promise.all([
      // Customers owned by me (ownership key = Agent profile id).
      agentId
        ? prisma.customer.count({ where: { referralAgentId: agentId } })
        : 0,
      // Active workflow steps assigned to me (ASSIGNED / IN_PROGRESS).
      prisma.workflowStepInstance.count({
        where: { assignedToId: userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      }),
      // Steps I completed today.
      prisma.workflowStepInstance.count({
        where: {
          assignedToId: userId,
          status: "COMPLETED",
          completedAt: { gte: startOfToday },
        },
      }),
      // Open opportunities assigned to me.
      prisma.opportunity.count({ where: { assignedToId: userId } }),
      // Average lead score across MY customers (Customer.score 0..100).
      agentId
        ? prisma.customer.aggregate({
            where: { referralAgentId: agentId },
            _avg: { score: true },
          })
        : null,
      // Last 5 active tasks (due soonest first).
      prisma.workflowStepInstance.findMany({
        where: { assignedToId: userId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          status: true,
          dueAt: true,
          createdAt: true,
          step: { select: { title: true, department: true } },
        },
      }),
      // Last 5 customers I own.
      agentId
        ? prisma.customer.findMany({
            where: { referralAgentId: agentId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              fullName: true,
              customerCode: true,
              primaryPhone: true,
              segment: true,
              score: true,
              createdAt: true,
            },
          })
        : [],
      // Top 5 opportunities of mine by estimated value.
      prisma.opportunity.findMany({
        where: { assignedToId: userId },
        orderBy: { estimatedValue: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          estimatedValue: true,
          probability: true,
          stage: { select: { name: true, color: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        myStats: {
          myCustomers,
          myTasks,
          myTasksCompletedToday,
          myOpportunities,
          avgLeadScore: avgScore?._avg.score ?? 0,
        },
        myTasksToday,
        myCustomersRecent,
        // Prisma Decimal → plain number for JSON serialization.
        myOpportunities: myOpportunitiesTop.map((o) => ({
          ...o,
          estimatedValue: o.estimatedValue === null ? null : Number(o.estimatedValue),
        })),
      },
    });
  } catch (error) {
    console.error("[CRM] my-dashboard stats failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" },
      },
      { status: 500 }
    );
  }
}