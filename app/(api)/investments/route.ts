import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAgentId } from "@/lib/forms/agent-resolver";
import { getCurrentUser } from "@/lib/auth-guard";
import { z } from "zod";
import { normalizeCustomerForm } from "@/lib/customer-form-normalizer";
import { getWorkflowCodeByFormType } from "@/lib/workflow-code-map";
import { startWorkflow } from "@/services/workflow.service";
import { apiError, apiSuccess } from "@/lib/forms/response";
import { formatFaDateTime } from "@/lib/date-fa";
import { hookCrmFormSubmission } from "@/lib/crm/form-hook";
import {
  tryClaimIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  deleteIdempotencyKey,
  getIdempotencyKey,
} from "@/lib/idempotency-redis";
import {
  findLatestPotentialDuplicate,
  isRecentWithinSeconds,
} from "@/lib/forms/idempotency";

// Zod schema for investment form validation
const investmentFormSchema = z.object({
  it: z.enum(["installment", "buy-sell"], { message: "نوع سرمایه‌گذاری نامعتبر است" }),
  nm: z.string().min(2, "نام الزامی است"),
  fm: z.string().min(2, "نام خانوادگی الزامی است"),
  ph: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  hk: z.string().min(1, "نحوه آشنایی الزامی است"),
  acc: z.literal(true),
});

/**
 * Resolve agentId from multiple sources:
 * 1. POST body (agentId field)
 * 2. agent_referral cookie
 * 3. JWT token (for authenticated agents)
 */
async function resolveAgentAttribution(req: NextRequest, body: any): Promise<string | null> {
  const bodyAgentId = body?.agentId;
  if (bodyAgentId && typeof bodyAgentId === "string") {
    const agent = await prisma.agent.findUnique({ where: { id: bodyAgentId }, select: { id: true, active: true } });
    if (agent && agent.active) return agent.id;
  }

  const cookieAgentId = req.cookies.get("agent_referral")?.value;
  if (cookieAgentId) {
    const agent = await prisma.agent.findUnique({ where: { id: cookieAgentId }, select: { id: true, active: true } });
    if (agent && agent.active) return agent.id;
  }

  return resolveAgentId(req);
}

export async function POST(req: NextRequest) {
  let scopedIdempotencyKey: string | null = null;

  try {
    const body = await req.json();
    const { it, nm, fm, ph, hk, acc } = body;

    // Validate with Zod
    const validatedData = investmentFormSchema.parse({ it, nm, fm, ph, hk, acc });

    // Resolve agent attribution
    const agentId = await resolveAgentAttribution(req, body);
    const authUser = await getCurrentUser(req);
    const userId = authUser?.sub ?? null;

    const investmentFormType = `invest_${validatedData.it}`;
    const normalized = normalizeCustomerForm(investmentFormType, validatedData as any);
    const rawIdempotencyKey = getIdempotencyKey(req);

    // Scope the idempotency key to the authenticated user
    if (rawIdempotencyKey) {
      scopedIdempotencyKey = userId
        ? `idem:${userId}:${rawIdempotencyKey}`
        : `idem:anon:${rawIdempotencyKey}`;
    }

    // canonical type for workflow resolution/storage
    const canonicalFormType = normalized.formType || "investment";

    // Redis-backed idempotency check
    if (scopedIdempotencyKey) {
      const claim = await tryClaimIdempotencyKey(scopedIdempotencyKey);
      if (!claim.claimed && claim.existing.status === "completed") {
        return apiSuccess(
          {
            message: "درخواست تکراری شناسایی شد. نتیجه قبلی بازگردانده شد.",
            id: claim.existing.formId,
            createdAt: claim.existing.createdAt,
            duplicate: true,
          },
          { duplicate: true },
          200
        );
      }
      if (!claim.claimed) {
        return apiError("DUPLICATE_REQUEST", "درخواست تکراری. لطفاً بعداً تلاش کنید.", 409);
      }
    } else {
      const latest = await findLatestPotentialDuplicate({
        formType: canonicalFormType,
        phone: normalized.phone,
        ...(agentId ? { agentId } : {}),
      });

      if (latest && isRecentWithinSeconds(latest.createdAt, 10)) {
        return apiError("DUPLICATE_REQUEST", "A similar request was submitted recently", 409);
      }
    }

    const workflowCode = getWorkflowCodeByFormType(canonicalFormType);

    if (!workflowCode) {
      return apiError("WORKFLOW_CODE_NOT_FOUND", "کد ورک‌فلو برای نوع فرم یافت نشد", 400);
    }

    // ─── ATOMIC TRANSACTION ─────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const customerForm = await tx.customerForm.create({
        data: {
          formType: canonicalFormType,
          formData: validatedData as any,
          phone: normalized.phone,
          fullName: normalized.fullName,
          metadata: {
            normalized: normalized.normalized,
            ...(scopedIdempotencyKey ? { idempotencyKey: scopedIdempotencyKey } : {}),
          } as any,
          workflowCode: null,
          workflowStarted: false,
          agentId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: agentId ?? null,
          entity: "form",
          entityId: customerForm.id,
          action: "CREATE" as any,
          metadata: {
            formType: canonicalFormType,
            phone: normalized.phone,
          } as any,
        },
      });

      return customerForm;
    });
    // ─── END ATOMIC TRANSACTION ─────────────────────────────────

    const workflowResult = await startWorkflow({
      workflowCode,
      formData: validatedData as any,
      metadata: {
        source: "public_form",
        formType: canonicalFormType,
      },
      customerFormId: result.id,
    });

    if (!workflowResult.success) {
      // ─── RECOVERY: Roll back the created form ───────────────
      // Delete the created form to avoid orphaned records and
      // delete the idempotency key so the client can retry fresh.
      try {
        await prisma.customerForm.delete({
          where: { id: result.id },
        });
      } catch (deleteError) {
        console.error("Failed to rollback customerForm after workflow failure:", deleteError);
      }

      if (scopedIdempotencyKey) {
        await deleteIdempotencyKey(scopedIdempotencyKey);
      }

      return apiError(
        "WORKFLOW_START_FAILED",
        "فرم سرمایه‌گذاری ثبت شد اما شروع ورک‌فلو ناموفق بود.",
        500
      );
    }

    const workflowInstanceId = workflowResult.data?.instanceId ?? null;
    const createdAtFa = formatFaDateTime(result.createdAt);

    await prisma.customerForm.update({
      where: { id: result.id },
      data: {
        workflowCode,
        workflowStarted: true,
        metadata: {
          normalized: normalized.normalized,
          workflowInstanceId,
          createdAtFa,
          ...(scopedIdempotencyKey ? { idempotencyKey: scopedIdempotencyKey } : {}),
        } as any,
      },
    });

    if (scopedIdempotencyKey) {
      await completeIdempotencyKey(scopedIdempotencyKey, result.id, { workflowCode, workflowInstanceId });
    }

    // CRM (Phase 1): upsert customer + log interaction — never breaks the form
    await hookCrmFormSubmission({
      phone: normalized.phone,
      fullName: normalized.fullName,
      formType: canonicalFormType,
      customerFormId: result.id,
      agentId,
    });

    return apiSuccess(
      {
        message: "فرم سرمایه‌گذاری با موفقیت ثبت شد.",
        id: result.id,
        createdAt: result.createdAt,
        workflowCode,
        workflowStarted: true,
        metadata: {
          normalized: normalized.normalized,
          workflowInstanceId,
        },
      },
      null,
      201
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "خطا در اعتبارسنجی داده‌ها", 400);
    }
    console.error("Error saving investment form:", error);
    return apiError("INTERNAL_SERVER_ERROR", "خطا در ثبت فرم سرمایه‌گذاری", 500);
  }
}