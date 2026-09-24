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
import { scheduleTrigger } from "@/lib/crm/automation-engine";

// --- Zod schemas for each sell tab ---

const positiveNumericString = (label: string) =>
  z
    .string()
    .min(1, `${label} الزامی است`)
    .refine((v) => Number(v.replace(/,/g, "")) > 0, `${label} باید بیشتر از صفر باشد`);

const sellDirectSchema = z.object({
  dNm: z.string().min(2, "نام الزامی است"),
  dFm: z.string().min(2, "نام خانوادگی الزامی است"),
  dPh: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  dProv: z.number({ message: "استان الزامی است" }),
  dCity: z.number({ message: "شهر الزامی است" }),
  dBD: z.string().regex(/^\d{2}$/, "روز تولد باید ۲ رقمی باشد"),
  dBM: z.string().regex(/^\d{2}$/, "ماه تولد باید ۲ رقمی باشد"),
  dBY: z.string().regex(/^\d{4}$/, "سال تولد باید ۴ رقمی باشد"),
  dOwn: z.enum(["self", "other"], { message: "مالکیت باید 'self' یا 'other' باشد" }),
  dCond: z.enum(["new", "used"], { message: "وضعیت باید 'new' یا 'used' باشد" }),
  dSimPh: z.string().regex(/^0912\d{7}$/, "شماره فروشی باید ۱۱ رقم و با 0912 شروع شود"),
  dPrice: positiveNumericString("قیمت"),
  dHk: z.string().min(1, "نحوه آشنایی الزامی است"),
  attachmentIds: z.array(z.string()).optional(),
});

const sellMarketSchema = z
  .object({
    mNm: z.string().min(2, "نام الزامی است"),
    mFm: z.string().min(2, "نام خانوادگی الزامی است"),
    mPh: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
    mProv: z.number({ message: "استان الزامی است" }),
    mCity: z.number({ message: "شهر الزامی است" }),
    mBD: z.string().regex(/^\d{2}$/, "روز تولد باید ۲ رقمی باشد"),
    mBM: z.string().regex(/^\d{2}$/, "ماه تولد باید ۲ رقمی باشد"),
    mBY: z.string().regex(/^\d{4}$/, "سال تولد باید ۴ رقمی باشد"),
    mSimPh: z.string().regex(/^0912\d{7}$/, "شماره فروشی باید ۱۱ رقم و با 0912 شروع شود").optional(),
    mSph: z.string().regex(/^0912\d{7}$/, "شماره فروشی باید ۱۱ رقم و با 0912 شروع شود").optional(),
    mDesPh: z.string().regex(/^0912\d{7}$/, "شماره دلخواه باید ۱۱ رقم و با 0912 شروع شود"),
    mPrice: positiveNumericString("قیمت"),
    mDuration: z.string().optional(),
    mOwn: z.enum(["self", "other"], { message: "مالکیت باید 'self' یا 'other' باشد" }),
    mCond: z.enum(["new", "used"], { message: "وضعیت باید 'new' یا 'used' باشد" }),
    mHk: z.string().min(1, "نحوه آشنایی الزامی است"),
    nt: z.string().min(1, "توضیحات الزامی است").optional(),
    attachmentIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    const sim = data.mSimPh || data.mSph;
    if (!sim) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "شماره فروشی الزامی است",
        path: ["mSimPh"],
      });
    }
  })
  .transform((data) => {
    const normalized = { ...data, mSimPh: data.mSimPh || data.mSph };
    delete (normalized as any).mSph;
    return normalized;
  });

const sellConsSchema = z.object({
  nm: z.string().min(2, "نام الزامی است"),
  fm: z.string().min(2, "نام خانوادگی الزامی است"),
  ph: z.string().regex(/^09\d{9}$/, "شماره موبایل باید ۱۱ رقمی و با 09 شروع شود"),
  prov: z.number({ message: "استان الزامی است" }),
  city: z.number({ message: "شهر الزامی است" }),
  birthDay: z.string().regex(/^\d{2}$/, "روز تولد باید ۲ رقمی باشد"),
  birthMonth: z.string().regex(/^\d{2}$/, "ماه تولد باید ۲ رقمی باشد"),
  birthYear: z.string().regex(/^\d{4}$/, "سال تولد باید ۴ رقمی باشد"),
  sph: z.string().regex(/^0912\d{7}$/, "شماره امانت باید ۱۱ رقم و با 0912 شروع شود"),
  price: positiveNumericString("قیمت"),
  duration: z.string().min(1, "مدت زمان الزامی است"),
  own: z.enum(["self", "other"], { message: "مالکیت باید 'self' یا 'other' باشد" }),
  cond: z.enum(["new", "used"], { message: "وضعیت باید 'new' یا 'used' باشد" }),
  hk: z.string().min(1, "نحوه آشنایی الزامی است"),
  attachmentIds: z.array(z.string()).optional(),
});

/**
 * Resolve agentId from multiple sources:
 * 1. POST body (agentId field in formData)
 * 2. agent_referral cookie
 * 3. JWT token (for authenticated agents)
 */
async function resolveAgentAttribution(req: NextRequest, formData: any): Promise<string | null> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Priority 1: query string / POST body
  const queryAgentId = req.nextUrl.searchParams.get("agentId");
  const bodyAgentId = formData?.agentId;
  const candidateAgentId = queryAgentId || bodyAgentId;
  if (candidateAgentId && typeof candidateAgentId === "string" && uuidRegex.test(candidateAgentId)) {
    const agent = await prisma.agent.findUnique({ where: { id: candidateAgentId }, select: { id: true, active: true } });
    if (agent && agent.active) return agent.id;
  }

  // Priority 2: agent_referral cookie
  const cookieAgentId = req.cookies.get("agent_referral")?.value;
  if (cookieAgentId && uuidRegex.test(cookieAgentId)) {
    const agent = await prisma.agent.findUnique({ where: { id: cookieAgentId }, select: { id: true, active: true } });
    if (agent && agent.active) return agent.id;
  }

  // Priority 3: JWT token
  return resolveAgentId(req);
}

async function handleSellForm(
  formData: unknown,
  formType: string,
  agentId: string | null,
  req: NextRequest,
  userId: string | null
) {
  let validatedData: unknown;

  switch (formType) {
    case "sell_direct":
      validatedData = sellDirectSchema.parse(formData);
      break;
    case "sell_market":
      validatedData = sellMarketSchema.parse(formData);
      break;
    case "sell_cons":
      validatedData = sellConsSchema.parse(formData);
      break;
    default:
      throw new Error("Invalid form type");
  }

  const normalized = normalizeCustomerForm(formType, validatedData as any);
  const rawIdempotencyKey = getIdempotencyKey(req);

  // Scope the idempotency key to the authenticated user
  const scopedIdempotencyKey = rawIdempotencyKey
    ? (userId ? `idem:${userId}:${rawIdempotencyKey}` : `idem:anon:${rawIdempotencyKey}`)
    : null;

  // Redis-backed idempotency check
  if (scopedIdempotencyKey) {
    const claim = await tryClaimIdempotencyKey(scopedIdempotencyKey);
    if (!claim.claimed && claim.existing.status === "completed") {
      return { duplicate: true, id: claim.existing.formId, createdAt: claim.existing.createdAt };
    }
    if (!claim.claimed) {
      return { duplicateSoft: true };
    }
  } else {
    const latest = await findLatestPotentialDuplicate({
      formType: normalized.formType,
      phone: normalized.phone,
      ...(agentId ? { agentId } : {}),
    });

    if (latest && isRecentWithinSeconds(latest.createdAt, 10)) {
      return { duplicateSoft: true };
    }
  }

  const workflowCode = getWorkflowCodeByFormType(normalized.formType);
  if (!workflowCode) {
    throw new Error("WORKFLOW_CODE_NOT_FOUND");
  }

  // ─── ATOMIC TRANSACTION ─────────────────────────────────────
  const customerForm = await prisma.$transaction(async (tx) => {
    const form = await tx.customerForm.create({
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

    // Link attachments to this form using the formId foreign key
    // Only link attachments owned by the authenticated user.
    const attachmentIds = (validatedData as any).attachmentIds as string[] | undefined;
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

    return form;
  });
  // ─── END ATOMIC TRANSACTION ─────────────────────────────────

  const workflowResult = await startWorkflow({
    workflowCode,
    formData: validatedData as any,
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
    // release the idempotency key so the user can retry cleanly.
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

      return {
        ...customerForm,
        workflowCode,
        workflowStarted: false,
        workflowError: workflowResult.error,
      };
  }

  const workflowInstanceId = workflowResult.data?.instanceId ?? null;
  const createdAtFa = formatFaDateTime(customerForm.createdAt);

  await prisma.customerForm.update({
    where: { id: customerForm.id },
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

  // CRM (Phase 4.7a): fire form_submitted automation rules — fire-and-forget
  scheduleTrigger({
    type: "form_submitted",
    entityType: "customer",
    entityId: normalized.phone ?? undefined,
    data: {
      formType: normalized.formType,
      phone: normalized.phone,
      name: normalized.fullName,
      customerFormId: customerForm.id,
      workflowCode,
    },
  });

  if (scopedIdempotencyKey) {
    await completeIdempotencyKey(scopedIdempotencyKey, customerForm.id, { workflowCode, workflowInstanceId });
  }

  // CRM (Phase 1): upsert customer + log interaction — never breaks the form
  await hookCrmFormSubmission({
    phone: normalized.phone,
    fullName: normalized.fullName,
    formType: normalized.formType,
    customerFormId: customerForm.id,
    agentId,
  });

  return {
    ...customerForm,
    workflowCode,
    workflowStarted: true,
    metadata: {
      normalized: normalized.normalized,
      workflowInstanceId,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { formType, formData } = body;

    if (!formType || !formData) {
      return apiError("INVALID_REQUEST", "formType و formData الزامی هستند", 400);
    }

    const agentId = await resolveAgentAttribution(req, formData);

    switch (formType) {
      case "sell_direct":
      case "sell_market":
      case "sell_cons":
        try {
          const authUser = await getCurrentUser(req);
          const userId = authUser?.sub ?? null;
          const result: any = await handleSellForm(formData, formType, agentId, req, userId);
          if (result.duplicate) {
            return apiSuccess(
              {
                message: "درخواست تکراری شناسایی شد. نتیجه قبلی بازگردانده شد.",
                id: result.id,
                createdAt: result.createdAt,
                duplicate: true,
              },
              { duplicate: true },
              200
            );
          }

          if (result.duplicateSoft) {
            return apiError("DUPLICATE_REQUEST", "A similar request was submitted recently", 409);
          }

          if (result.workflowStarted === false) {
            return apiError("WORKFLOW_START_FAILED", "فرم فروش ثبت شد اما شروع ورک‌فلو ناموفق بود.", 500);
          }

          // ابطال کش پس از ثبت موفق فرم فروش
          await invalidateSearchCache("sim");

          return apiSuccess(
            {
              message: "فرم فروش با موفقیت ثبت شد.",
              id: result.id,
              createdAt: result.createdAt,
              workflowCode: result.workflowCode,
              workflowStarted: true,
              metadata: result.metadata,
            },
            null,
            201
          );
        } catch (err) {
          if (err instanceof z.ZodError) {
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: "VALIDATION_ERROR",
                  message: "خطا در اعتبارسنجی داده‌ها",
                  details: err.issues,
                },
              },
              { status: 400 }
            );
          }
          throw err;
        }
      default:
        return apiError("INVALID_FORM_TYPE", "نوع فرم نامعتبر است", 400);
    }
  } catch (error) {
    console.error("Error saving sell form:", error);
    return apiError("INTERNAL_SERVER_ERROR", "خطا در ثبت فرم فروش", 500);
  }
}
