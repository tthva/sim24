import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAgentId } from "@/lib/forms/agent-resolver";
import { getCurrentUser } from "@/lib/auth-guard";
import { z } from "zod";
import { normalizeCustomerForm } from "@/lib/customer-form-normalizer";
import { getWorkflowCodeByFormType } from "@/lib/workflow-code-map";
import { startWorkflow } from "@/services/workflow.service";
import { apiError, apiSuccess } from "@/lib/forms/response";
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
import { invalidateSearchCache } from "@/lib/search-cache";
import { formatFaDateTime } from "@/lib/date-fa";
import { hookCrmFormSubmission } from "@/lib/crm/form-hook";

// Zod schema for buy form validation (direct)
const positiveNumericString = (label: string) =>
  z
    .string()
    .min(1, `${label} الزامی است`)
    .refine((v) => Number(v.replace(/,/g, "")) > 0, `${label} باید بیشتر از صفر باشد`);

const buyFormSchema = z.object({
  nm: z.string().min(2, "نام الزامی است"),
  fm: z.string().min(2, "نام خانوادگی الزامی است"),
  ph: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  prov: z.number({ message: "استان الزامی است" }),
  city: z.number({ message: "شهر الزامی است" }),
  birthDay: z.string().min(1, "روز تولد الزامی است"),
  birthMonth: z.string().min(1, "ماه تولد الزامی است"),
  birthYear: z.string().min(4, "سال تولد الزامی است"),
  pref: z.string().regex(/^0912\d{7}$/, "شماره دلخواه باید ۱۱ رقم و با 0912 شروع شود").optional(),
  hk: z.string().min(1, "نحوه آشنایی الزامی است"),
  attachmentIds: z.array(z.string()).optional(),
});

// Zod schema for installment form
const installmentFormSchema = z.object({
  nm: z.string().min(2, "نام الزامی است"),
  fm: z.string().min(2, "نام خانوادگی الزامی است"),
  ph: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  sp: positiveNumericString("مبلغ سیمکارت"),
  dp: positiveNumericString("پیش پرداخت"),
  mo: z.number().min(1).max(12, "تعداد اقساط بین ۱ تا ۱۲ ماه"),
  hk: z.string().min(1, "نحوه آشنایی الزامی است"),
  prov: z.number({ message: "استان الزامی است" }),
  city: z.number({ message: "شهر الزامی است" }),
  pref: z.string().regex(/^0912\d{7}$/, "شماره دلخواه باید ۱۱ رقم و با 0912 شروع شود").optional(),
  attachmentIds: z.array(z.string()).optional(),
});

// Zod schema for preorder form
const preorderFormSchema = z.object({
  nm: z.string().min(2, "نام الزامی است"),
  fm: z.string().min(2, "نام خانوادگی الزامی است"),
  ph: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  nt: z.string().min(2, "توضیحات الزامی است"),
  hk: z.string().min(1, "نحوه آشنایی الزامی است"),
  attachmentIds: z.array(z.string()).optional(),
});

/**
 * Resolve agentId from multiple sources:
 * 1. POST body (agentId field)
 * 2. agent_referral cookie
 * 3. JWT token (for authenticated agents)
 */
async function resolveAgentAttribution(req: NextRequest, body: any): Promise<string | null> {
  // Priority 1: POST body
  const bodyAgentId = body?.agentId;
  if (bodyAgentId && typeof bodyAgentId === "string") {
    const agent = await prisma.agent.findUnique({ where: { id: bodyAgentId }, select: { id: true, active: true } });
    if (agent && agent.active) return agent.id;
  }

  // Priority 2: agent_referral cookie
  const cookieAgentId = req.cookies.get("agent_referral")?.value;
  if (cookieAgentId) {
    const agent = await prisma.agent.findUnique({ where: { id: cookieAgentId }, select: { id: true, active: true } });
    if (agent && agent.active) return agent.id;
  }

  // Priority 3: JWT token (authenticated agent session)
  return resolveAgentId(req);
}

export async function POST(req: NextRequest) {
  let scopedIdempotencyKey: string | null = null;

  try {
    // Parse body
    const body = await req.json();
    const { formType, formData } = body;

    if (!formType || !formData) {
      return apiError("INVALID_REQUEST", "formType و formData الزامی هستند", 400);
    }

    // Resolve agent attribution from multiple sources
    const agentId = await resolveAgentAttribution(req, formData);
    const authUser = await getCurrentUser(req);
    const userId = authUser?.sub ?? null;

    // Validate form data based on formType
    let validatedData;
    switch (formType) {
      case "buy_direct":
        try {
          validatedData = buyFormSchema.parse(formData);
        } catch (err) {
          if (err instanceof z.ZodError) {
            return apiError("VALIDATION_ERROR", "خطا در اعتبارسنجی داده‌ها", 400);
          }
          throw err;
        }
        break;
      case "buy_installment":
        try {
          validatedData = installmentFormSchema.parse(formData);
        } catch (err) {
          if (err instanceof z.ZodError) {
            return apiError("VALIDATION_ERROR", "خطا در اعتبارسنجی داده‌ها", 400);
          }
          throw err;
        }
        break;
      case "buy_preorder":
        try {
          validatedData = preorderFormSchema.parse(formData);
        } catch (err) {
          if (err instanceof z.ZodError) {
            return apiError("VALIDATION_ERROR", "خطا در اعتبارسنجی داده‌ها", 400);
          }
          throw err;
        }
        break;
      default:
        return apiError("INVALID_FORM_TYPE", "نوع فرم نامعتبر است", 400);
    }

    // Fix 1: Prevent IDOR for anonymous users — reject attachmentIds if userId is null
    if (validatedData.attachmentIds && validatedData.attachmentIds.length > 0 && !userId) {
      return apiError("UNAUTHORIZED_ATTACHMENT", "برای پیوند فایل ضروری، لطفاً وارد حساب کاربری خود شوید.", 401);
    }

    const normalized = normalizeCustomerForm(formType, validatedData as any);
    const rawIdempotencyKey = getIdempotencyKey(req);

    // Scope the idempotency key to the authenticated user
    if (rawIdempotencyKey) {
      scopedIdempotencyKey = userId
        ? `idem:${userId}:${rawIdempotencyKey}`
        : `idem:anon:${rawIdempotencyKey}`;
    }

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
      // Soft duplicate detection (no idempotency key)
      const latest = await findLatestPotentialDuplicate(
        agentId
          ? { formType: normalized.formType, phone: normalized.phone, agentId }
          : { formType: normalized.formType, phone: normalized.phone }
      );

      if (latest && isRecentWithinSeconds(latest.createdAt, 10)) {
        return apiError("DUPLICATE_REQUEST", "A similar request was submitted recently", 409);
      }
    }

    const workflowCode = getWorkflowCodeByFormType(normalized.formType);
    if (!workflowCode) {
      return apiError("WORKFLOW_CODE_NOT_FOUND", "کد ورک‌فلو برای نوع فرم یافت نشد", 400);
    }

    // ─── ATOMIC TRANSACTION ───────────────────────────────────
    // All DB writes in a single prisma.$transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the customer form
      const customerForm = await tx.customerForm.create({
        data: {
          formType: normalized.formType,
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

      // 2. Create audit log
      await tx.auditLog.create({
        data: {
          actorId: agentId ?? null,
          entity: "form",
          entityId: customerForm.id,
          action: "CREATE" as any,
          metadata: {
            formType: normalized.formType,
            phone: normalized.phone,
          } as any,
        },
      });

      // 3. Link attachments to this form using the formId foreign key
      //    Only link attachments owned by the authenticated user.
      const attachmentIds = validatedData.attachmentIds;
      if (attachmentIds && attachmentIds.length > 0) {
        // Normalize to unique IDs
        const uniqueIds = [...new Set(attachmentIds)];

        const updateResult = await tx.attachment.updateMany({
          where: {
            id: { in: uniqueIds },
            formId: null,
            ...(userId ? { uploadedById: userId } : {}),
          },
          data: {
            formId: customerForm.id,
          },
        });

        // Verify all requested attachments were linked
        if (updateResult.count !== uniqueIds.length) {
          throw new Error("Unauthorized or invalid attachment selection.");
        }
      }

      return customerForm;
    });
    // ─── END ATOMIC TRANSACTION ───────────────────────────────

    // Start workflow (outside transaction — it's an async side effect)
    const workflowResult = await startWorkflow({
      workflowCode,
      formData: validatedData as any,
      metadata: {
        source: "public_form",
        formType: normalized.formType,
      },
      customerFormId: result.id,
    });

    // Update form with workflow result (outside transaction to keep transaction short)
    if (!workflowResult.success) {
      // ─── RECOVERY: Roll back the created form ───────────────
      // The DB transaction committed, but workflow start failed.
      // Delete the created form to avoid orphaned records and
      // delete the idempotency key so the client can retry
      // as a completely fresh request.
      try {
        await prisma.customerForm.delete({
          where: { id: result.id },
        });
      } catch (deleteError) {
        console.error("Failed to rollback customerForm after workflow failure:", deleteError);
      }

      // Delete the idempotency key so the user can retry fresh
      if (scopedIdempotencyKey) {
        await deleteIdempotencyKey(scopedIdempotencyKey);
      }

      return apiError("WORKFLOW_START_FAILED", "فرم ثبت شد اما شروع ورک‌فلو ناموفق بود", 500);
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

    // Mark idempotency as completed
    if (scopedIdempotencyKey) {
      await completeIdempotencyKey(scopedIdempotencyKey, result.id, {
        workflowCode,
        workflowInstanceId,
      });
    }

    // ابطال کش پس از ثبت موفق فرم خرید
    await invalidateSearchCache("sim");

    // CRM (Phase 1): upsert customer + log interaction — never breaks the form
    await hookCrmFormSubmission({
      phone: normalized.phone,
      fullName: normalized.fullName,
      formType: normalized.formType,
      customerFormId: result.id,
      agentId,
    });

    return apiSuccess(
      {
        message: "فرم با موفقیت ثبت شد.",
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
    console.error("Error saving buy form:", error);
    return apiError("INTERNAL_SERVER_ERROR", "خطا در ثبت فرم", 500);
  }
}
