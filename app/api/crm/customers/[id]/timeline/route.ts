import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { hasViewAllPermission, getUserAgentId } from "@/lib/crm/scope";

type RouteContext = { params: Promise<{ id: string }> };

// ─── Unified timeline entry (Phase 4.8c) ─────────────────
export type TimelineEntryType =
  | "form_submitted"
  | "workflow_started"
  | "step_assigned"
  | "step_completed"
  | "step_rejected"
  | "communication"
  | "opportunity_created"
  | "opportunity_won"
  | "opportunity_lost"
  | "note_added"
  | "activity";

export type TimelineEntry = {
  id: string;
  type: TimelineEntryType;
  title: string;
  description: string | null;
  timestamp: string; // ISO
  status?: string | null;
  meta?: Record<string, string | number | null>;
};

// ─── GET /api/crm/customers/[id]/timeline ────────────────
// Customer 360 unified activity feed: forms + workflow steps +
// communications + opportunities + notes + interactions, sorted DESC.
//
// Relation chain for workflow data (no direct FK from Customer):
//   Customer.primaryPhone
//     → CustomerForm.phone          (both normalized to 09xxxxxxxxx)
//       → WorkflowInstance.customerFormId = CustomerForm.id
//         → WorkflowStepInstance.instanceId = WorkflowInstance.id
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;
    const sp = request.nextUrl.searchParams;
    const requestedLimit = Number(sp.get("limit") || 200);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(500, Math.max(1, Math.trunc(requestedLimit)))
      : 200;

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true, primaryPhone: true, referralAgentId: true },
    });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }

    // Phase 4.8b-2 scope: without crm.view_all only the owning agent may read.
    const userId = auth.user.sub;
    const canViewAll = await hasViewAllPermission(userId);
    if (!canViewAll) {
      const agentId = await getUserAgentId(userId);
      if (!agentId || customer.referralAgentId !== agentId) {
        return NextResponse.json(
          { success: false, error: { code: "FORBIDDEN", message: "دسترسی غیر مجاز" } },
          { status: 403 }
        );
      }
    }

    // ── Fetch all sources in parallel ──
    const [forms, communications, activities, opportunities, notes, interactions] =
      await Promise.all([
        prisma.customerForm.findMany({
          where: { phone: customer.primaryPhone },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.communication.findMany({
          where: { customerId: id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.activity.findMany({
          where: { customerId: id },
          include: { assignedTo: { select: { fullName: true, username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.opportunity.findMany({
          where: { customerId: id },
          include: { stage: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.customerNote.findMany({
          where: { customerId: id },
          include: { author: { select: { fullName: true, username: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.customerInteraction.findMany({
          where: { customerId: id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);

    const formIds = forms.map((f) => f.id);

    // Workflow instances for this customer's forms + their step instances.
    // Chain: CustomerForm.id → WorkflowInstance.customerFormId → StepInstances.
    const workflowInstances = formIds.length
      ? await prisma.workflowInstance.findMany({
          where: { customerFormId: { in: formIds } },
          include: {
            version: {
              include: { workflow: { select: { title: true, code: true } } },
            },
            stepInstances: {
              include: {
                step: { select: { title: true, stepOrder: true } },
                assignedTo: { select: { fullName: true, username: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : [];

    const entries: TimelineEntry[] = [];


    // 1) Form submissions
    for (const f of forms) {
      entries.push({
        id: `form-${f.id}`,
        type: "form_submitted",
        title: `ثبت فرم ${f.formType}`,
        description: f.fullName || null,
        timestamp: f.createdAt.toISOString(),
        status: f.workflowStarted ? "workflow_started" : "submitted",
        meta: {
          formType: f.formType,
          workflowCode: f.workflowCode,
          customerFormId: f.id,
        },
      });
    }

    // 2) Workflow instances + step-by-step tracking
    for (const inst of workflowInstances) {
      const wfTitle = inst.version.workflow.title;
      const wfCode = inst.version.workflow.code;

      entries.push({
        id: `wf-${inst.id}`,
        type: "workflow_started",
        title: `شروع فرایند ${wfTitle}`,
        description: null,
        timestamp: inst.createdAt.toISOString(),
        status: inst.status,
        meta: { workflowCode: wfCode, instanceId: inst.id },
      });

      for (const s of inst.stepInstances) {
        const stepTitle = s.step.title;
        const assignee = s.assignedTo
          ? s.assignedTo.fullName || s.assignedTo.username
          : null;

        // step_assigned — emitted from the step instance creation event
        entries.push({
          id: `step-a-${s.id}`,
          type: "step_assigned",
          title: assignee
            ? `ارجاع مرحله «${stepTitle}»`
            : `ایجاد مرحله «${stepTitle}»`,
          description: assignee ? `مسئول: ${assignee}` : null,
          timestamp: (s.assignedAt ?? s.createdAt).toISOString(),
          status: s.status,
          meta: { workflow: wfTitle, stepOrder: s.step.stepOrder, assignee },
        });

        // step_rejected — status REJECTED
        if (s.status === "REJECTED") {
          entries.push({
            id: `step-r-${s.id}`,
            type: "step_rejected",
            title: `رد مرحله «${stepTitle}»`,
            description: s.notes || null,
            timestamp: (s.completedAt ?? s.updatedAt).toISOString(),
            status: s.status,
            meta: { workflow: wfTitle, stepOrder: s.step.stepOrder, assignee },
          });
        }

        // step_completed — completedAt present
        if (s.completedAt && s.status !== "REJECTED") {
          entries.push({
            id: `step-c-${s.id}`,
            type: "step_completed",
            title: `تکمیل مرحله «${stepTitle}»`,
            description: s.notes || null,
            timestamp: s.completedAt.toISOString(),
            status: s.status,
            meta: { workflow: wfTitle, stepOrder: s.step.stepOrder, assignee },
          });
        }
      }
    }


    // 3) Communications
    const CHANNEL_FA: Record<string, string> = {
      sms: "پیامک", call: "تماس", note: "یادداشت", chat: "گفتگو",
    };
    for (const c of communications) {
      entries.push({
        id: `comm-${c.id}`,
        type: "communication",
        title:
          c.subject ||
          `${CHANNEL_FA[c.channel] || c.channel} ${c.direction === "inbound" ? "دریافتی" : "ارسالی"}`,
        description: c.content.length > 300 ? `${c.content.slice(0, 300)}…` : c.content,
        timestamp: (c.sentAt ?? c.createdAt).toISOString(),
        status: c.status,
        meta: {
          channel: c.channel,
          direction: c.direction,
          durationSec: c.durationSec,
        },
      });
    }

    // 4) Opportunities — created / won / lost
    for (const o of opportunities) {
      entries.push({
        id: `opp-c-${o.id}`,
        type: "opportunity_created",
        title: `فرصت جدید: ${o.title}`,
        description: o.description,
        timestamp: o.createdAt.toISOString(),
        status: o.stage.name,
        meta: {
          value: o.estimatedValue ? Number(o.estimatedValue) : null,
          probability: o.probability,
          stage: o.stage.name,
        },
      });
      if (o.wonAt) {
        entries.push({
          id: `opp-w-${o.id}`,
          type: "opportunity_won",
          title: `برد فرصت: ${o.title}`,
          description: null,
          timestamp: o.wonAt.toISOString(),
          status: "won",
          meta: { value: o.estimatedValue ? Number(o.estimatedValue) : null },
        });
      }
      if (o.lostAt) {
        entries.push({
          id: `opp-l-${o.id}`,
          type: "opportunity_lost",
          title: `باخت فرصت: ${o.title}`,
          description: o.rejectionNotes,
          timestamp: o.lostAt.toISOString(),
          status: "lost",
          meta: { value: o.estimatedValue ? Number(o.estimatedValue) : null },
        });
      }
    }

    // 5) Notes
    for (const n of notes) {
      entries.push({
        id: `note-${n.id}`,
        type: "note_added",
        title: "یادداشت جدید",
        description: n.content,
        timestamp: n.createdAt.toISOString(),
        status: n.pinned ? "pinned" : null,
        meta: {
          author: n.author ? n.author.fullName || n.author.username : null,
        },
      });
    }


    // 6) Activities
    for (const a of activities) {
      entries.push({
        id: `act-${a.id}`,
        type: "activity",
        title: a.title,
        description: a.description,
        timestamp: (a.completedAt ?? a.createdAt).toISOString(),
        status: a.status,
        meta: {
          activityType: a.type,
          priority: a.priority,
          assignee: a.assignedTo.fullName || a.assignedTo.username,
        },
      });
    }

    // 7) Generic interactions — skip form_submission rows already covered
    //    by the CustomerForm source (same event, referenceId = form id).
    const INTERACTION_TYPE_MAP: Record<string, TimelineEntryType> = {
      form_submission: "form_submitted",
      call: "communication",
      sms: "communication",
      email: "communication",
      note: "note_added",
      meeting: "activity",
    };
    for (const it of interactions) {
      if (
        it.interactionType === "form_submission" &&
        it.referenceId &&
        formIds.includes(it.referenceId)
      ) {
        continue; // duplicate of a form_submitted entry
      }
      const mapped = INTERACTION_TYPE_MAP[it.interactionType] ?? "activity";
      entries.push({
        id: `int-${it.id}`,
        type: mapped,
        title: it.title,
        description: it.description,
        timestamp: it.createdAt.toISOString(),
        status: it.interactionType,
        meta: { source: "interaction", interactionType: it.interactionType },
      });
    }

    // ── Sort DESC by timestamp ──
    entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      data: { entries: entries.slice(0, limit), total: entries.length },
    });
  } catch (error) {
    console.error("[CRM] customer timeline failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
