// ============================
// SIM24 — Workflow Service (Enterprise)
// ============================
// Business logic: transaction safety, load balancing, reject logic,
// step reassign, SLA support, timeline, audit logging.
// No Prisma calls — delegates to repository.
// ============================

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import * as WorkflowRepo from "@/repositories/workflow.repository";
import type { ApiResponse } from "@/lib/types/api";
import { successResponse, errorResponse } from "@/lib/types/api";
import { formatFaDateTime } from "@/lib/date-fa";

// ─── Types ────────────────────────────────────────────────────────────────

export type StartWorkflowInput = {
  workflowCode: string;
  formData: unknown;
  metadata?: unknown;
  customerFormId?: string;
};

export type CompleteStepInput = {
  stepInstanceId: string;
  actorId: string;
  formData?: unknown;
  data?: unknown;
  notes?: string;
  action?: string;
};

export type ReassignStepInput = {
  stepInstanceId: string;
  actorId: string;
  newAgentUserId: string;
};

export type WorkflowResult = { /* ... same as before */ instanceId: string; status: string; currentStep: any; stepInstances: any[] };
export type AgentTaskResult = {
  stepInstanceId: string;
  workflowCode: string;
  workflowTitle: string;
  stepName: string;
  stepDepartment: string;
  // کارشناس: نوع فرم (برای INVESTMENT_REQUEST = it: installment | buy-sell)
  formType?: string | null;
  // کارشناس قیمت: فلگ ریسک ضدتقلب PRICE_SEARCH
  risk?: string | null;
  stepOrder: number;
  formSchema: unknown;
  allowedActions: string[];
  instanceStatus: string;
  stepStatus: string;
  dueAt: string | null;
  createdAt: string;
  customerFullName: string | null;
  customerPhone: string | null;
};
export type StepDetailResult = { stepInstanceId: string; status: string; step: any; workflow: any; instanceData: unknown; assignedTo: any; dueAt: string | null; createdAt: string };
export type TimelineEntry = { stepInstanceId: string; stepOrder: number; stepTitle: string; department: string; status: string; assignedTo: { id: string; name: string | null } | null; assignedAt: string | null; completedAt: string | null; dueAt: string | null; createdAt: string };

// ─── Helpers ──────────────────────────────────────────────────────────────

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

async function audit(actorId: string | undefined, entity: string, entityId: string | undefined, action: string, department?: string, metadata?: unknown) {
  try {
    await WorkflowRepo.createAuditLog({ actorId, entity, entityId, action, department, metadata });
  } catch { /* audit errors should never break the flow */ }
}

/**
 * Auto-sync: when a SELL_CONSIGNMENT workflow instance's FINAL step completes
 * (PRODUCT step — product-manager/escrow با Inputsite) and the workflow is
 * marked COMPLETED, create a ConsignmentItem record from the instance formData.
 * Idempotent (dedupe بر اساس workflowInstanceId — هر نمونه فقط یک آیتم).
 * Callers must wrap in try/catch — failures here must never break the workflow.
 */
async function syncConsignmentItemForWorkflow(instanceId: string, actorId?: string | null): Promise<void> {
  const inst = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    select: {
      formData: true,
      currentStepOrder: true,
      status: true,
      version: {
        select: {
          workflow: { select: { code: true } },
          steps: { select: { stepOrder: true, department: true, isFinal: true } },
        },
      },
    },
  });
  if (!inst) return;

  const workflowCode = inst.version?.workflow?.code;
  if (workflowCode !== "SELL_CONSIGNMENT") return;

  // فقط پس از تکمیل مراحل — نه صرفاً با رسیدن به مرحله PRODUCT
  if (inst.status !== "COMPLETED") return;

  const currentStepDef = inst.version?.steps?.find(
    (s: any) => s.stepOrder === inst.currentStepOrder
  );
  const currentDepartment = currentStepDef?.department;

  // مرحله نهایی باید PRODUCT باشد (یا پرچم isFinal داشته باشد)
  if (currentDepartment !== "PRODUCT" && !currentStepDef?.isFinal) return;

  const formData = (inst.formData ?? {}) as Record<string, unknown>;
  // Ù†Ø±Ù…Ø§Ù„Ø³Ø§Ø²ÛŒ Ø´Ù…Ø§Ø±Ù‡ Ù…ÙˆØ¨Ø§ÛŒÙ„: Ø§Ø±Ù‚Ø§Ù… ÙØ§Ø±Ø³ÛŒ Ø¨Ù‡ Ø§Ù†Ú¯Ù„ÛŒØ³ÛŒØŒ Ø­Ø°ÙÙ Ø­Ø±ÙˆÙ/Ú©Ø§Ø±Ø§Ú©ØªØ±Ù‡Ø§ÛŒ Ø§Ø¶Ø§ÙÙ‡ØŒ ØªØ±Ø§Ø´ Ø¨Ù‡ 11 Ø±Ù‚Ù…
  const normalizeMobile = (v: unknown): string => {
    const digits = String(v ?? "")
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[^\d]/g, "");
    return digits.length > 11 ? digits.slice(0, 11) : digits;
  };
  const simNumber = normalizeMobile(formData.sph);
  if (!simNumber) return;

  // Dedupe بر پایه‌ی خودِ نمونه‌ی ورک‌فلو (نه شماره سیم) — هر نمونه فقط یک آیتم دارد.
  // رقابت هم‌زمانی (P2002) هم بی‌خطر است چون workflowInstanceId در دیتابیس unique است.
  const existing = await prisma.consignmentItem.findFirst({
    where: { workflowInstanceId: instanceId },
  });
  if (existing) return;

  const ownerName = [formData.nm, formData.fm]
    .filter((p) => p != null && String(p).trim() !== "")
    .map((p) => String(p).trim())
    .join(" ")
    .trim();
  // قیمت: قیمت مدنظر مشتری، و در نبود آن قیمت کارشناس فروش (OKPrice)
  const priceRaw =
    (formData.price != null && String(formData.price).trim() !== ""
      ? String(formData.price).trim()
      : "") ||
    (formData.OKPrice != null && String(formData.OKPrice).trim() !== ""
      ? String(formData.OKPrice).trim()
      : "");

  await prisma.consignmentItem.create({
    data: {
      simNumber,
      ownerName: ownerName || "—",
      phone: normalizeMobile(formData.ph) || "—",
      price: priceRaw !== "" ? priceRaw : null,
      notes: "ثبت از طریق ورک‌فلو",
      source: "workflow",
      status: "available",
      workflowInstanceId: instanceId,
      // مدت امانت: فرم امانی "30 روز" می‌فرستد → عدد 30 ذخیره می‌شود
      duration: (() => {
        const raw = String(formData.duration ?? "").trim();
        const digits = raw.replace(/[^\d]/g, "");
        const n = Number(digits);
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
    },
  });

  await audit(actorId ?? undefined, "consignment_item", simNumber, "CREATE", "PRODUCT", {
    workflowInstanceId: instanceId,
  });
}

// ─── Parallel forks (post-completion fan-out) ──────────────────────────────
// Workflows where completing a step must create SEVERAL step instances at once
// (parallel branch) instead of the single sequential next step. The instance
// stays IN_PROGRESS until EVERY forked step instance is completed — completion
// order does not matter, and duplicate instances are never created.
const PARALLEL_FORKS: Record<
  string,
  { afterStepCode: string; forkStepOrders: number[] }
> = {
  // SELL_MARKET_SWAP: after SELL (stage 3) both PRODUCT stages run in parallel:
  //   4 «حذف از سایت» (خط دلخواه)  +  5 «نهایی‌سازی تعویض/فروش» (خط فروخته شده)
  SELL_MARKET_SWAP: {
    afterStepCode: "sell-market-execution",
    forkStepOrders: [4, 5],
  },
};

/**
 * Atomically assign the next workflow step to the least-busy eligible operator
 * (RBAC role=operator) for the step's department.
 *
 * Concurrency-safe: acquires a PostgreSQL transaction-scoped advisory lock for
 * the department BEFORE computing workload, then selects the operator and creates
 * the StepInstance — all on the SAME transaction client (tx).
 *
 * If no eligible operator exists, throws a domain error (NO_OPERATOR:<dept>),
 * which rolls back the entire transaction. No unassigned/orphan StepInstance is
 * ever created.
 */
async function assignNextStepAtomically(
  tx: Prisma.TransactionClient,
  instanceId: string,
  nextStep: any
): Promise<{ agent: any; dueAt: Date | null }> {
  // Lock before workload calculation (serializes concurrent assignment per department)
  await WorkflowRepo.acquireDepartmentAssignmentLock(tx, nextStep.department);

  // Workload is computed UNDER the lock, on the same tx client
  const nextAgent = await WorkflowRepo.findLeastBusyOperatorByWorkload(tx, nextStep.department);
  if (!nextAgent) {
    throw new Error(`NO_OPERATOR:${nextStep.department}`);
  }

  const nextDueAt = nextStep.slaHours ? addHours(new Date(), nextStep.slaHours) : null;

  // Create the next StepInstance on the SAME transaction
  await WorkflowRepo.createStepInstanceTx(tx, {
    instanceId,
    stepId: nextStep.id,
    status: "ASSIGNED",
    assignedToId: nextAgent.user.id,
    dueAt: nextDueAt,
  });

  return { agent: nextAgent, dueAt: nextDueAt };
}

// ─── Workflow Start (with SLA + load balancing + concurrency-safe) ────────

export async function startWorkflow(input: StartWorkflowInput): Promise<ApiResponse<WorkflowResult>> {
  const workflow = await WorkflowRepo.findActiveWorkflowByCode(input.workflowCode);
  if (!workflow) return errorResponse(`Workflow not found: ${input.workflowCode}`, null, "WORKFLOW_NOT_FOUND");

  const version = workflow.versions[0];
  if (!version || version.steps.length === 0) return errorResponse("No active version", null, "NO_VERSION");

  const initialStep = version.steps.find((s: any) => s.isInitial);
  if (!initialStep) return errorResponse("No initial step", null, "NO_INITIAL_STEP");

  // All DB writes (operator selection + instance create + step create + audit)
  // happen inside a transaction with a department advisory lock, so concurrent
  // submissions cannot select the same operator.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock before workload calculation (serializes concurrent assignment per department)
      await WorkflowRepo.acquireDepartmentAssignmentLock(tx, initialStep.department);

      // Load-balanced operator selection (RBAC role=operator) — workload computed under lock
      const agent = await WorkflowRepo.findLeastBusyOperatorByWorkload(tx, initialStep.department);
      if (!agent) {
        throw new Error(`NO_OPERATOR:${initialStep.department}`);
      }

      // SLA calculation
      const slaHours = initialStep.slaHours ?? null;
      const dueAt = slaHours ? addHours(new Date(), slaHours) : null;

      const instance = await WorkflowRepo.createWorkflowInstanceTx(tx, {
        versionId: version.id,
        agentId: agent.id,
        status: "IN_PROGRESS",
        formData: input.formData,
        metadata: input.metadata,
        currentStepOrder: initialStep.stepOrder,
        customerFormId: input.customerFormId,
        dueAt: dueAt ?? undefined,
      });

      const stepInstance = await WorkflowRepo.createStepInstanceTx(tx, {
        instanceId: instance.id,
        stepId: initialStep.id,
        status: "ASSIGNED",
        assignedToId: agent.user.id,
        dueAt,
      });

      // Audit: workflow started (closest existing action: ASSIGN)
      await WorkflowRepo.createAuditLogTx(tx, {
        actorId: agent.user.id,
        entity: "workflow",
        entityId: instance.id,
        action: "ASSIGN",
        department: initialStep.department,
        metadata: {
          workflowCode: input.workflowCode,
          formCustomerFormId: input.customerFormId ?? null,
          currentStepOrder: initialStep.stepOrder,
        },
      });

      // Audit: step assignment (existing)
      await WorkflowRepo.createAuditLogTx(tx, {
        actorId: agent.user.id,
        entity: "workflow",
        entityId: instance.id,
        action: "STEP_ASSIGNED",
        department: initialStep.department,
        metadata: { stepCode: initialStep.code, stepTitle: initialStep.title },
      });

      return { agent, instance, stepInstance, dueAt };
    });

    const { agent, instance, stepInstance, dueAt } = result;

    // Store server-side Persian (Jalali) creation date on the workflow instance metadata
    try {
      const createdAtFa = formatFaDateTime(instance.createdAt);
      await prisma.workflowInstance.update({
        where: { id: instance.id },
        data: {
          metadata: {
            ...((instance.metadata as any) ?? {}),
            createdAtFa,
          } as any,
        },
      });
    } catch {
      // non-critical: createdAtFa must never break workflow start
    }

    // Notification: create task notification for the assigned agent (best-effort, outside tx)
    try {
      await (prisma as any).notification.create({
        data: {
          agentId: agent.id, // Notification.agentId expects Agent.id
          title: "تسک جدید",
          body: initialStep.title,
          link: `/operators/workflow/${stepInstance.id}`,
          read: false,
        },
      });
    } catch {
      // notifications must never break workflow start
    }

    return successResponse({
      instanceId: instance.id,
      status: instance.status,
      currentStep: { id: initialStep.id, title: initialStep.title, department: initialStep.department, stepOrder: initialStep.stepOrder },
      stepInstances: [{
        id: stepInstance.id, stepCode: initialStep.code, stepTitle: initialStep.title,
        status: stepInstance.status, department: initialStep.department,
        assignedTo: { id: agent.user.id, name: agent.user.fullName || agent.user.username },
        completedAt: null,
      }],
    }, `Workflow started: ${workflow.title}`);
  } catch (error: any) {
    // NO_OPERATOR:<dept> throws roll back the whole transaction (no orphan records)
    if (error?.message && String(error.message).startsWith("NO_OPERATOR:")) {
      return errorResponse(`No operator available in ${String(error.message).split(":")[1]}`, null, "NO_OPERATOR");
    }
    throw error;
  }
}

// ─── Step Completion (Transaction-safe + Reject logic + SLA) ──────────────

export async function completeStep(input: CompleteStepInput): Promise<ApiResponse<WorkflowResult>> {
  try {
    const txResult = await prisma.$transaction(async (tx) => {
    // Re-fetch step instance inside transaction for consistency
    const stepInstance = await tx.workflowStepInstance.findUnique({
      where: { id: input.stepInstanceId },
      include: {
        step: true,
        assignedTo: { select: { id: true, fullName: true, username: true } },
        instance: {
          include: {
            version: {
              include: {
                steps: { orderBy: { stepOrder: "asc" } },
                workflow: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    if (!stepInstance) return errorResponse("Step instance not found", null, "STEP_NOT_FOUND");
    if (stepInstance.status === "COMPLETED") return errorResponse("Step already completed", "STEP_ALREADY_COMPLETED");

    // IDOR protection: only the assigned operator (or an admin) may complete this step.
    // role=operator alone does not allow completing other operators' tasks.
    if (stepInstance.assignedToId && stepInstance.assignedToId !== input.actorId) {
      const actor = await tx.user.findUnique({
        where: { id: input.actorId },
        select: { userType: true },
      });
      if (!actor || actor.userType !== "ADMIN") {
        return errorResponse("Forbidden: not assigned to this step", "FORBIDDEN");
      }
    }

    const actorAgent = await WorkflowRepo.findAgentByUserIdAndDepartmentTx(tx, input.actorId, stepInstance.step.department);
    if (!actorAgent) return errorResponse(`Actor not in department: ${stepInstance.step.department}`, null, "INVALID_DEPARTMENT");

    const instance = stepInstance.instance;
    const allSteps = instance.version.steps;
    const currentStepOrder = stepInstance.step.stepOrder;
    const targetStatus = input.action === "REJECT" ? "REJECTED" : input.action === "SKIP" ? "SKIPPED" : "COMPLETED";

            // ==================== Partial Save (SAVE): keep the task IN_PROGRESS ====================
    // Persists formData without completing/advancing the step.
    if (input.action === "SAVE") {
      console.log("💾 [completeStep SAVE] entered", {
        instanceId: instance.id,
        stepInstanceId: input.stepInstanceId,
        formDataKeys: Object.keys(input.formData ?? {}),
        formData: input.formData,
      });
      const saveResult = await tx.workflowStepInstance.updateMany({
        where: { id: input.stepInstanceId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        data: {
          status: "IN_PROGRESS",
          data: input.data as any ?? undefined,
          formData: input.formData as any ?? undefined,
          notes: input.notes,
          startedAt: new Date(),
        },
      });
      if (saveResult.count === 0) {
        return errorResponse("این تسک قفل شده است", "STEP_NOT_EDITABLE");
      }

      // Merge saved (partial) formData into the workflow-level formData so
      // reopening the task restores checkbox/text values via instanceData.
      // IMPORTANT: never let the frontend's empty/undefined input values clobber
      // already-saved instance data (e.g. a value written by an earlier step).
      // A stage may include a field the current operator left blank, but that blank
      // must not erase what a previous step persisted. Boolean `false` (an explicit
      // untick) and non-empty strings/numbers are still applied normally.
      if (input.formData && Object.keys(input.formData).length > 0) {
        const existingFormData = (instance.formData as Record<string, unknown>) ?? {};
        const mergedSaveData: Record<string, unknown> = { ...existingFormData };
        for (const [k, v] of Object.entries(input.formData as Record<string, unknown>)) {
          const isEmptyString = typeof v === "string" && v.trim() === "";
          const isNullish = v === undefined || v === null;
          const existingHasValue =
            existingFormData[k] !== undefined &&
            existingFormData[k] !== null &&
            existingFormData[k] !== "";
          // Always apply booleans (real checkbox states). For empty text/nullish,
          // only apply if there was no meaningful existing value (i.e. don't wipe).
          if (typeof v === "boolean" || (!isEmptyString && !isNullish) || !existingHasValue) {
            mergedSaveData[k] = v;
          }
        }
        console.log("💾 [merge] existing keys:", Object.keys(existingFormData), "| merged keys:", Object.keys(mergedSaveData));
        await tx.workflowInstance.update({
          where: { id: instance.id },
          data: { formData: mergedSaveData as any },
        });
      }

      await WorkflowRepo.createAuditLogTx(tx, {
        actorId: input.actorId,
        entity: "workflow_step",
        entityId: input.stepInstanceId,
        action: "UPDATE",
        department: stepInstance.step.department,
        metadata: { workflowInstanceId: instance.id, savedNotCompleted: true },
      });

      return successResponse({
        instanceId: instance.id,
        status: "IN_PROGRESS",
        currentStep: { id: stepInstance.step.id, title: stepInstance.step.title, department: stepInstance.step.department, stepOrder: stepInstance.step.stepOrder },
        stepInstances: [{
          id: stepInstance.id, stepCode: stepInstance.step.code, stepTitle: stepInstance.step.title,
          status: "IN_PROGRESS", department: stepInstance.step.department,
          assignedTo: stepInstance.assignedTo ? { id: stepInstance.assignedTo.id, name: stepInstance.assignedTo.fullName || stepInstance.assignedTo.username } : null,
          completedAt: null,
        }],
      });
    }

    // Update step instance — optimistic-lock via updateMany: only the first
    // concurrent completion (status still ASSIGNED/IN_PROGRESS) wins; any
    // racing second call matches 0 rows and short-circuits with 409 BEFORE
    // creating the next step instance (no duplicate tasks).
    const updateResult = await tx.workflowStepInstance.updateMany({
      where: { id: input.stepInstanceId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      data: {
        status: targetStatus as any,
        data: input.data as any ?? undefined,
        formData: input.formData as any ?? undefined,
        notes: input.notes,
        completedAt: targetStatus === "COMPLETED" || targetStatus === "REJECTED" ? new Date() : undefined,
        startedAt: new Date(),
      },
    });
    if (updateResult.count === 0) {
      return errorResponse("این تسک قبلاً تکمیل شده یا قابل انجام نیست", "STEP_ALREADY_COMPLETED");
    }

    // Merge this step's formData (e.g. agentNote / agentreport) into the
    // workflow-level formData so subsequent steps can read previous agents'
    // notes via instanceData (previousAgentNotes).
    if (input.formData && Object.keys(input.formData).length > 0) {
      const existing = (instance.formData as Record<string, unknown>) ?? {};
      const mergedFormData: Record<string, unknown> = { ...existing };
      for (const [k, v] of Object.entries(input.formData as Record<string, unknown>)) {
        const isEmptyString = typeof v === "string" && v.trim() === "";
        const isNullish = v === undefined || v === null;
        const existingHasValue =
          existing[k] !== undefined && existing[k] !== null && existing[k] !== "";
        if (typeof v === "boolean" || (!isEmptyString && !isNullish) || !existingHasValue) {
          mergedFormData[k] = v;
        }
      }
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: { formData: mergedFormData as any },
      });
      // Keep the in-memory snapshot consistent for later reads in this tx
      instance.formData = mergedFormData as any;
    }

    let newStatus: string;
    let newStepOrder = currentStepOrder;

    if (targetStatus === "REJECTED") {
      const rejectBehavior = stepInstance.step.rejectBehavior || "END_WORKFLOW";

      if (rejectBehavior === "END_WORKFLOW") {
        newStatus = "REJECTED";
        await tx.workflowInstance.update({ where: { id: instance.id }, data: { status: "REJECTED", completedAt: new Date() } });
        await tx.workflowStepInstance.updateMany({
          where: { instanceId: instance.id, status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] } },
          data: { status: "SKIPPED" },
        });
      } else {
        // GO_TO_STEP — skip to next if available
        const nextStep = allSteps.find((s: any) => s.stepOrder === currentStepOrder + 1);
        if (nextStep) {
          const { dueAt: nextDueAt } = await assignNextStepAtomically(tx, instance.id, nextStep);
          newStepOrder = nextStep.stepOrder;
          newStatus = "IN_PROGRESS";
          await tx.workflowInstance.update({ where: { id: instance.id }, data: { currentStepOrder: newStepOrder, dueAt: nextDueAt } });
        } else {
          newStatus = "REJECTED";
          await tx.workflowInstance.update({ where: { id: instance.id }, data: { status: "REJECTED", completedAt: new Date() } });
        }
      }

      await audit(input.actorId, "workflow_step", input.stepInstanceId, "STEP_REJECTED", stepInstance.step.department, { workflowInstanceId: instance.id, notes: input.notes });
    } else if (targetStatus === "COMPLETED") {
      // ── Parallel-aware completion ─────────────────────────────────────────
      // 1) Sibling branches still open? (parallel fork in flight) — stay
      //    IN_PROGRESS and assign nothing. The workflow completes only when
      //    the LAST active branch finishes, in any completion order.
      const openSiblings = await tx.workflowStepInstance.findMany({
        where: {
          instanceId: instance.id,
          id: { not: input.stepInstanceId },
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
        select: { stepId: true },
      });

      if (openSiblings.length > 0) {
        const siblingOrders = openSiblings
          .map((s) => allSteps.find((st: any) => st.id === s.stepId)?.stepOrder)
          .filter((o): o is number => typeof o === "number");
        newStepOrder = siblingOrders.length ? Math.min(...siblingOrders) : currentStepOrder;
        newStatus = "IN_PROGRESS";
        await tx.workflowInstance.update({
          where: { id: instance.id },
          data: { currentStepOrder: newStepOrder },
        });
      } else {
        // 2) Fork fan-out: completing the fork trigger step creates ALL fork
        //    step instances at once (each load-balanced to its own operator).
        const fork = PARALLEL_FORKS[instance.version.workflow.code];
        const forkOrders =
          fork && stepInstance.step.code === fork.afterStepCode
            ? fork.forkStepOrders
            : null;

        if (forkOrders && forkOrders.length > 0) {
          const dueAts: (Date | null)[] = [];
          for (const order of forkOrders) {
            const forkStep = allSteps.find((s: any) => s.stepOrder === order);
            if (!forkStep) throw new Error(`FORK_STEP_MISSING:${instance.version.workflow.code}:${order}`);
            // Idempotent: never create a duplicate instance for a fork step.
            const alreadyInstanced = await tx.workflowStepInstance.findFirst({
              where: { instanceId: instance.id, stepId: forkStep.id },
              select: { id: true },
            });
            if (alreadyInstanced) continue;
            const { dueAt } = await assignNextStepAtomically(tx, instance.id, forkStep);
            dueAts.push(dueAt);
          }
          newStepOrder = Math.min(...forkOrders);
          newStatus = "IN_PROGRESS";
          const earliestDueAt = dueAts.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
          await tx.workflowInstance.update({
            where: { id: instance.id },
            data: { currentStepOrder: newStepOrder, dueAt: earliestDueAt },
          });
        } else {
          // 3) Sequential: assign the single next step — unless an instance
          //    for it already exists (a parallel sibling completed earlier),
          //    in which case this was the last open branch → COMPLETED.
          const nextStep = allSteps.find((s: any) => s.stepOrder === currentStepOrder + 1);
          const nextAlreadyInstanced = nextStep
            ? await tx.workflowStepInstance.findFirst({
                where: { instanceId: instance.id, stepId: nextStep.id },
                select: { id: true },
              })
            : null;

          if (nextStep && !nextAlreadyInstanced) {
            const { dueAt: nextDueAt } = await assignNextStepAtomically(tx, instance.id, nextStep);
            newStepOrder = nextStep.stepOrder;
            newStatus = "IN_PROGRESS";
            await tx.workflowInstance.update({ where: { id: instance.id }, data: { currentStepOrder: newStepOrder, dueAt: nextDueAt } });
          } else {
            newStatus = "COMPLETED";
            await tx.workflowInstance.update({ where: { id: instance.id }, data: { status: "COMPLETED", currentStepOrder: currentStepOrder, completedAt: new Date() } });
          }
        }
      }

      await audit(input.actorId, "workflow_step", input.stepInstanceId, "STEP_COMPLETED", stepInstance.step.department, { workflowInstanceId: instance.id, notes: input.notes });
    } else {
      // SKIP
      const nextStep = allSteps.find((s: any) => s.stepOrder === currentStepOrder + 1);
      if (nextStep) {
        const { dueAt: nextDueAt } = await assignNextStepAtomically(tx, instance.id, nextStep);
        newStepOrder = nextStep.stepOrder;
        newStatus = "IN_PROGRESS";
        await tx.workflowInstance.update({ where: { id: instance.id }, data: { currentStepOrder: newStepOrder, dueAt: nextDueAt } });
      } else {
        newStatus = "COMPLETED";
        await tx.workflowInstance.update({ where: { id: instance.id }, data: { status: "COMPLETED", completedAt: new Date() } });
      }
    }

    // Return updated state
    const updatedInstance = await WorkflowRepo.findWorkflowInstanceById(instance.id);
    if (!updatedInstance) return errorResponse("Fetch error", null, "FETCH_ERROR");

    const currentStepDef = newStatus === "COMPLETED" || newStatus === "REJECTED" ? null : allSteps.find((s: any) => s.stepOrder === newStepOrder);

      return successResponse({
        instanceId: updatedInstance.id,
        status: newStatus,
        currentStep: currentStepDef ? { id: currentStepDef.id, title: currentStepDef.title, department: currentStepDef.department, stepOrder: currentStepDef.stepOrder } : null,
        stepInstances: updatedInstance.stepInstances.map((si: any) => ({
          id: si.id, stepCode: si.step.code, stepTitle: si.step.title, status: si.status, department: si.step.department,
          assignedTo: si.assignedTo ? { id: si.assignedTo.id, name: si.assignedTo.fullName || si.assignedTo.username } : null,
          completedAt: si.completedAt?.toISOString() ?? null,
        })),
      });
    });

    // Best-effort: auto-create ConsignmentItem when a SELL_CONSIGNMENT
    // workflow's FINAL step completes and the instance is marked COMPLETED
    // (must never break the workflow)
    if (txResult.success) {
      try {
        await syncConsignmentItemForWorkflow(txResult.data.instanceId, input.actorId);
      } catch (syncError) {
        console.error("ConsignmentItem sync failed:", syncError);
      }
    }

    return txResult;
  } catch (error: any) {
    // NO_OPERATOR:<dept> throws roll back the whole transaction (no orphan records)
    if (error?.message && String(error.message).startsWith("NO_OPERATOR:")) {
      return errorResponse(`No operator available in ${String(error.message).split(":")[1]}`, null, "NO_OPERATOR");
    }
    throw error;
  }
}

// ─── Step Reassign ─────────────────────────────────────────────────────────

export async function reassignStep(input: ReassignStepInput): Promise<ApiResponse<{ stepInstanceId: string; newAgentUserId: string }>> {
  const stepInstance = await WorkflowRepo.findStepInstanceById(input.stepInstanceId);
  if (!stepInstance) return errorResponse("Step instance not found", null, "STEP_NOT_FOUND");

  // Validate new agent exists and is in same department
  const newAgent = await WorkflowRepo.findAgentByUserIdAndDepartment(input.newAgentUserId, stepInstance.step.department);
  if (!newAgent) return errorResponse(`Agent not found in department: ${stepInstance.step.department}`, null, "INVALID_AGENT");

  await WorkflowRepo.reassignStepInstance(input.stepInstanceId, input.newAgentUserId);

  await audit(input.actorId, "workflow_step", input.stepInstanceId, "STEP_REASSIGNED", stepInstance.step.department, {
    previousAgent: stepInstance.assignedTo?.id ?? null,
    newAgent: input.newAgentUserId,
    stepCode: stepInstance.step.code,
  });

  return successResponse({ stepInstanceId: input.stepInstanceId, newAgentUserId: input.newAgentUserId }, "Step reassigned");
}

// ─── Get Instance ─────────────────────────────────────────────────────────

export async function getWorkflowInstance(instanceId: string): Promise<ApiResponse<WorkflowResult>> {
  const instance = await WorkflowRepo.findWorkflowInstanceById(instanceId);
  if (!instance) return errorResponse("Instance not found", null, "INSTANCE_NOT_FOUND");

  return successResponse({
    instanceId: instance.id, status: instance.status,
    currentStep: instance.status !== "COMPLETED" && instance.currentStepOrder
      ? (() => { const s = instance.version.steps.find((x: any) => x.stepOrder === instance.currentStepOrder); return s ? { id: s.id, title: s.title, department: s.department, stepOrder: s.stepOrder } : null; })()
      : null,
    stepInstances: instance.stepInstances.map((si: any) => ({
      id: si.id, stepCode: si.step.code, stepTitle: si.step.title, status: si.status, department: si.step.department,
      assignedTo: si.assignedTo ? { id: si.assignedTo.id, name: si.assignedTo.fullName || si.assignedTo.username } : null,
      completedAt: si.completedAt?.toISOString() ?? null,
    })),
  });
}

// ─── Agent Tasks ──────────────────────────────────────────────────────────

export async function getAgentTasks(userId: string): Promise<ApiResponse<AgentTaskResult[]>> {
  const tasks = await WorkflowRepo.findAgentTasks(userId);

  // Stage indicator: which chain checkboxes are already ticked on the saved
  // step formData (only meaningful for IN_PROGRESS tasks).
  const STAGE_ORDER = ["mozakere", "paying", "confirm", "sanad", "hozor", "mali", "daftar", "daryaft", "bastanGhararDad", "testsanad", "sarmaye", "hasInstallmentOption"];
  const STAGE_LABELS: Record<string, string> = {
    mozakere: "مذاکره",
    paying: "پرداخت",
    confirm: "تأیید",
    sanad: "سند",
    hozor: "حضور",
    mali: "مالی",
    daftar: "ثبت دفتر",
    daryaft: "دریافت",
    bastanGhararDad: "بستن قرارداد",
    testsanad: "تست سند",
    sarmaye: "سرمایه‌گذار",
    hasInstallmentOption: "امکان اقساط",
  };

  return successResponse(
    tasks.map((t: any) => {
      const savedFormData = (t.formData ?? {}) as Record<string, unknown>;
      const doneStages = STAGE_ORDER.filter((k) => savedFormData[k] === true).map((k) => STAGE_LABELS[k]);
      const stageProgress = doneStages.length > 0 ? doneStages.join(" ✓، ") + " ✓" : null;
      return {
      stepInstanceId: t.id,
      workflowCode: t.instance.version.workflow.code,
      workflowTitle: t.instance.version.workflow.title,
      stepName: t.step.title,
      stepDepartment: t.step.department,
      // Investment type (from instanceData.it) — installment | buy-sell
      formType: typeof (t.instance.formData as any)?.it === "string" ? (t.instance.formData as any).it : null,
      // Anti-abuse risk flag (PRICE_SEARCH formData.metadata.risk)
      risk: (t.instance.formData as any)?.metadata?.risk ?? null,
      stepStatus: t.status,
      stageProgress,
      stepOrder: t.step.stepOrder,
      formSchema: t.step.formSchema,
      allowedActions: t.step.allowedActions,
      instanceStatus: t.instance.status,
      dueAt: t.instance.dueAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
            customerFullName: (() => {
        const fd = t.instance.formData as any;
        if (fd?.fullName) return fd.fullName;
        if (fd?.nm && fd?.fm) return `${fd.nm} ${fd.fm}`;
        if (fd?.nm) return fd.nm;
        if (fd?.dNm && fd?.dFm) return `${fd.dNm} ${fd.dFm}`;
        if (fd?.dNm) return fd.dNm;
        if (fd?.dFm) return fd.dFm;
        if (fd?.mNm && fd?.mFm) return `${fd.mNm} ${fd.mFm}`;
        if (fd?.mNm) return fd.mNm;
        if (fd?.mFm) return fd.mFm;
        return null;
      })(),
      customerPhone:
        (t.instance.formData as any)?.uph ??
        (t.instance.formData as any)?.ph ??
        (t.instance.formData as any)?.dPh ??
        (t.instance.formData as any)?.mPh ??
        (t.instance.formData as any)?.phone ??
        null,
      };
    })
  );
}

// ─── Get Step Detail ──────────────────────────────────────────────────────

export async function getStepDetail(stepInstanceId: string, actorUserId?: string): Promise<ApiResponse<StepDetailResult>> {
  const si = await WorkflowRepo.findStepInstanceByIdFull(stepInstanceId);
  if (!si) return errorResponse("Step not found", null, "STEP_NOT_FOUND");

  // IDOR protection: if actorUserId is provided, verify the step is assigned to them
  // (or they are an admin). This prevents operators from viewing other operators' tasks.
  if (actorUserId && si.assignedToId && si.assignedToId !== actorUserId) {
    // Check if actor is admin (admins can view all)
    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { userType: true },
    });
    if (!actor || actor.userType !== "ADMIN") {
      return errorResponse("Forbidden: not assigned to this step", "FORBIDDEN");
    }
  }

  return successResponse({
    stepInstanceId: si.id, status: si.status,
    step: { id: si.step.id, title: si.step.title, code: si.step.code, department: si.step.department, stepOrder: si.step.stepOrder, formSchema: si.step.formSchema, allowedActions: si.step.allowedActions, isInitial: si.step.isInitial, isFinal: si.step.isFinal, slaHours: si.step.slaHours, rejectBehavior: si.step.rejectBehavior },
    workflow: { code: si.instance.version.workflow.code, title: si.instance.version.workflow.title },
    instanceData: si.instance.formData,
    assignedTo: si.assignedTo ? { id: si.assignedTo.id, name: si.assignedTo.fullName || si.assignedTo.username } : null,
    dueAt: si.dueAt?.toISOString() ?? null, createdAt: si.createdAt.toISOString(),
  });
}

// ─── Timeline ─────────────────────────────────────────────────────────────

export async function getTimeline(instanceId: string): Promise<ApiResponse<{ instanceStatus: string; dueAt: string | null; entries: TimelineEntry[] }>> {
  const instance = await WorkflowRepo.findWorkflowInstanceById(instanceId);
  if (!instance) return errorResponse("Instance not found", null, "INSTANCE_NOT_FOUND");

  const entries = await WorkflowRepo.findStepInstancesByInstanceId(instanceId);

  const now = new Date();
  return successResponse({
    instanceStatus: instance.status,
    dueAt: instance.dueAt?.toISOString() ?? null,
    overdue: instance.dueAt && instance.status === "IN_PROGRESS" && now > instance.dueAt,
    entries: entries.map((e: any) => ({
      stepInstanceId: e.id, stepOrder: e.step.stepOrder, stepTitle: e.step.title,
      department: e.step.department, status: e.status,
      assignedTo: e.assignedTo ? { id: e.assignedTo.id, name: e.assignedTo.fullName || e.assignedTo.username } : null,
      assignedAt: e.assignedAt?.toISOString() ?? null,
      completedAt: e.completedAt?.toISOString() ?? null,
      dueAt: e.dueAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}