import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAgentId } from "@/lib/forms/agent-resolver";
import { getCurrentUser } from "@/lib/auth-guard";
import { z } from "zod";
import { normalizeCustomerForm } from "@/lib/customer-form-normalizer";
import { getWorkflowCodeByFormType } from "@/lib/workflow-code-map";
import { startWorkflow } from "@/services/workflow.service";
import {
  findLatestPotentialDuplicate,
  getIdempotencyKeyHeader,
  isRecentWithinSeconds,
} from "@/lib/forms/idempotency";
import {
  tryClaimIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  deleteIdempotencyKey,
} from "@/lib/idempotency-redis";
import { mergeMetadataWithIdempotency } from "@/lib/forms/idempotency";
import { invalidateSearchCache } from "@/lib/search-cache";
import { apiError, apiSuccess } from "@/lib/forms/response";
import { formatFaDateTime } from "@/lib/date-fa";
import { hookCrmFormSubmission } from "@/lib/crm/form-hook";
import { scheduleTrigger } from "@/lib/crm/automation-engine";
import { assessPriceSearchRisk } from "@/lib/phone-risk";

const searchFormSchema = z.object({
  nm: z.string().min(2, "نام الزامی است"),
  fm: z.string().min(2, "نام خانوادگی الزامی است"),
  uph: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  hk: z.string().min(1, "نحوه آشنایی الزامی است"),
  type: z.enum(["real_market_value", "search"], { message: "نوع فرم الزامی است" }),
  cond: z.enum(["dry", "used"]).optional(),
  ph: z.string().regex(/^09\d{9}$/).optional(),
  // Optional: array of attachment IDs to link to this form
  attachmentIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  let scopedIdempotencyKey: string | null = null;

  try {
    const agentId = await resolveAgentId(req);
    const authUser = await getCurrentUser(req);
    const userId = authUser?.sub ?? null;

    const body = await req.json();
    const { formType, formData } = body;

    if (!formType || !formData) {
      return apiError("INVALID_REQUEST", "formType و formData الزامی هستند", 400);
    }

    // Support both "real_market_value" and "search"
    if (formType !== "real_market_value" && formType !== "search") {
      return apiError("INVALID_FORM_TYPE", "نوع فرم نامعتبر است", 400);
    }

    const validatedData = searchFormSchema.parse(formData);

    // Fix 1: Prevent IDOR for anonymous users — reject attachmentIds if userId is null
    if (validatedData.attachmentIds && validatedData.attachmentIds.length > 0 && !userId) {
      return apiError("UNAUTHORIZED_ATTACHMENT", "برای پیوند فایل ضروری، لطفاً وارد حساب کاربری خود شوید.", 401);
    }

    const normalized = normalizeCustomerForm(formType, validatedData as any);
    const rawIdempotencyKey = getIdempotencyKeyHeader(req.headers);

    // Scope the idempotency key to the authenticated user
    if (rawIdempotencyKey) {
      scopedIdempotencyKey = userId
        ? `idem:${userId}:${rawIdempotencyKey}`
        : `idem:anon:${rawIdempotencyKey}`;
    }

    if (scopedIdempotencyKey) {
      const claim = await tryClaimIdempotencyKey(scopedIdempotencyKey);
      if (!claim.claimed && claim.existing.status === "completed") {
        // Fetch the existing form to get workflow details
        const existingForm = await prisma.customerForm.findUnique({
          where: { id: claim.existing.formId },
          select: {
            id: true,
            createdAt: true,
            workflowCode: true,
            workflowStarted: true,
            metadata: true,
          },
        });
        
        if (existingForm) {
          return apiSuccess(
            {
              message: "درخواست تکراری شناسایی شد. نتیجه قبلی بازگردانده شد.",
              id: existingForm.id,
              createdAt: existingForm.createdAt,
              workflowCode: existingForm.workflowCode,
              workflowStarted: existingForm.workflowStarted,
              metadata: existingForm.metadata,
            },
            { duplicate: true },
            200
          );
        }
      }
      if (!claim.claimed) {
        return apiError("DUPLICATE_REQUEST", "A similar request was submitted recently", 409);
      }
    } else {
      const latest = await findLatestPotentialDuplicate(
        agentId
          ? {
              formType: normalized.formType,
              phone: normalized.phone,
              agentId,
            }
          : {
              formType: normalized.formType,
              phone: normalized.phone,
            }
      );

      if (latest && isRecentWithinSeconds(latest.createdAt, 10)) {
        return apiError(
          "DUPLICATE_REQUEST",
          "A similar request was submitted recently",
          409
        );
      }
    }

    const workflowCode = getWorkflowCodeByFormType(normalized.formType);
    if (!workflowCode) {
      return apiError("WORKFLOW_CODE_NOT_FOUND", "کد ورک‌فلو برای نوع فرم یافت نشد", 400);
    }

    // ─── SMART BLACKLIST/WHITELIST + AUTO DETECTION ───────────
    // بررسی هر دو شماره (ph = خط در حال استعلام، uph = تماس مشتری).
    // نتیجه در formData.metadata ذخیره می‌شود تا هم CustomerForm و هم
    // formData ورک‌فلو (بج داشبورد اپراتور) به آن دسترسی داشته باشند.
    const riskAssessment = await assessPriceSearchRisk([validatedData.ph, validatedData.uph]);
    const enrichedFormData = {
      ...(validatedData as any),
      metadata: { risk: riskAssessment.risk, riskReasons: riskAssessment.reasons },
    };

    // ─── ATOMIC TRANSACTION ───────────────────────────────────
    // Wrap form creation + attachment linking + audit log in a single transaction
    const customerForm = await prisma.$transaction(async (tx) => {
      // 1. Create the customer form
      const form = await tx.customerForm.create({
        data: {
          formType: normalized.formType,
          formData: enrichedFormData as any,
          phone: normalized.phone,
          fullName: normalized.fullName,
          metadata: mergeMetadataWithIdempotency(
            { normalized: normalized.normalized } as any,
            scopedIdempotencyKey
          ) as any,
          workflowCode: null,
          workflowStarted: false,
          agentId,
        },
      });

      // 2. Link attachments to this form using the formId foreign key
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
            formId: form.id,
          },
        });

        // Verify all requested attachments were linked
        if (updateResult.count !== uniqueIds.length) {
          throw new Error("Unauthorized or invalid attachment selection.");
        }
      }

      // 3. Create audit log
      await tx.auditLog.create({
        data: {
          actorId: agentId ?? null,
          entity: "form",
          entityId: form.id,
          action: "CREATE" as any,
          metadata: {
            formType: normalized.formType,
            phone: normalized.phone,
          } as any,
        },
      });

      return form;
    });
    // ─── END ATOMIC TRANSACTION ───────────────────────────────

    const workflowResult = await startWorkflow({
      workflowCode,
      formData: enrichedFormData as any,
      metadata: {
        source: "public_form",
        formType: normalized.formType,
      },
      customerFormId: customerForm.id,
    });

    if (!workflowResult.success) {
      // ─── RECOVERY: Roll back the created form ───────────────
      // The DB transaction committed, but workflow start failed.
      // Delete the created form to avoid orphaned records and
      // delete the idempotency key so the client can retry
      // as a completely fresh request.
      try {
        await prisma.customerForm.delete({
          where: { id: customerForm.id },
        });
      } catch (deleteError) {
        console.error("Failed to rollback customerForm after workflow failure:", deleteError);
      }

      // Delete the idempotency key so the user can retry fresh
      if (scopedIdempotencyKey) {
        await deleteIdempotencyKey(scopedIdempotencyKey);
      }

      return apiError(
        "WORKFLOW_START_FAILED",
        "فرم کارشناسی ثبت شد اما شروع ورک‌فلو ناموفق بود.",
        500
      );
    }

    const workflowInstanceId = workflowResult.data?.instanceId ?? null;
    const createdAtFa = formatFaDateTime(customerForm.createdAt);

    await prisma.customerForm.update({
      where: { id: customerForm.id },
      data: {
        workflowCode,
        workflowStarted: true,
        metadata: mergeMetadataWithIdempotency(
          {
            normalized: normalized.normalized,
            workflowInstanceId,
            createdAtFa,
          } as any,
          scopedIdempotencyKey
        ) as any,
      },
    });

    // Mark idempotency key as completed on success
    if (scopedIdempotencyKey) {
      await completeIdempotencyKey(scopedIdempotencyKey, customerForm.id, {
        workflowCode,
        workflowInstanceId,
      });
    }

    // Fix 3: Invalidate search cache on successful form submission
    await invalidateSearchCache("sim");

    // CRM (Phase 1): upsert customer + log interaction — never breaks the form
    const crmCustomer = await hookCrmFormSubmission({
      phone: normalized.phone,
      fullName: normalized.fullName,
      formType: normalized.formType,
      customerFormId: customerForm.id,
      agentId,
    });

    // CRM (Phase 4.7b): fire form_submitted automation rules — fire-and-forget
    scheduleTrigger({
      type: "form_submitted",
      entityType: "customer",
      entityId: normalized.phone ?? undefined,
      data: {
        formType: normalized.formType,
        phone: normalized.phone,
        name: normalized.fullName,
        customerId: crmCustomer?.id ?? undefined,
        customerFormId: customerForm.id,
        workflowCode,
      },
    });

    return apiSuccess(
      {
        message: "فرم کارشناسی با موفقیت ثبت شد.",
        id: customerForm.id,
        createdAt: customerForm.createdAt,
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
    // Release the idempotency key on any failure so the user can retry
    if (scopedIdempotencyKey) {
      await failIdempotencyKey(scopedIdempotencyKey).catch(() => {});
    }

    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "خطا در اعتبارسنجی داده‌ها", 400);
    }
    console.error("Error saving search form:", error);
    return apiError("INTERNAL_SERVER_ERROR", "خطا در ثبت فرم کارشناسی", 500);
  }
}
