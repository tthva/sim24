import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

// ─── Shared allow-lists ─────────────────────────────────────────
// AutomationRule.trigger is a free-form String column; this enum is the API
// allow-list and is exactly what lib/crm/automation-engine.ts matches on
// (findMany where trigger = event.type).
const TRIGGER_VALUES = [
  "form_submitted",
  "task_completed",
  "task_rejected",
  "communication_received",
  "stage_changed",
  "customer_created",
  "opportunity_won",
  "no_activity_days",
] as const;

const OPERATOR_VALUES = [
  "eq",
  "ne",
  "gt",
  "lt",
  "gte",
  "lte",
  "contains",
  "not_contains",
  "in",
  "not_in",
  "exists",
  "not_exists",
] as const;

// Only actions that automation-engine executeAction() can actually run are
// accepted here. Deliberately EXCLUDED so we never persist a rule that is
// guaranteed to fail at runtime:
//   - "change_opportunity_stage": the engine has no such case; every run would
//     throw "Unknown action" and be written to AutomationLog as a failure.
//   - "wait_days": the engine implements it as an explicit
//     "wait_days not implemented in Phase 4.2" throw.
// Widen this list only after the engine gains the corresponding case.
const ACTION_VALUES = [
  "send_sms",
  "send_notification",
  "create_task",
  "update_customer",
  "webhook",
] as const;

const conditionsSchema = z.array(
  z.object({
    field: z.string().min(1),
    op: z.enum(OPERATOR_VALUES),
    value: z.any().optional(),
  })
);

// .catchall(z.any()) keeps each action's own config object (the engine reads
// `action.config`). NOT .passthrough(), which types unknown keys as `unknown` — rejected by Prisma's Json input type.
const actionsSchema = z.array(
  z.object({ type: z.enum(ACTION_VALUES) }).catchall(z.any())
);

const createSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(1000).default(0),
  trigger: z.enum(TRIGGER_VALUES),
  triggerConfig: z.record(z.string(), z.any()).optional(),
  conditions: conditionsSchema,
  actions: actionsSchema,
});

const listQuerySchema = z.object({
  isActive: z.enum(["true", "false"]).optional(),
  trigger: z.enum(TRIGGER_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const CREATOR_SELECT = { id: true, fullName: true, username: true } as const;

// ─── GET /api/crm/automation/rules — list with filters ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "پارامترهای جستجو نامعتبر است" } },
        { status: 400 }
      );
    }
    const { isActive, trigger, page, limit } = parsed.data;

    const where = {
      ...(isActive ? { isActive: isActive === "true" } : {}),
      ...(trigger ? { trigger } : {}),
    };

    const [total, rules] = await Promise.all([
      prisma.automationRule.count({ where }),
      prisma.automationRule.findMany({
        where,
        include: {
          createdBy: { select: CREATOR_SELECT },
          _count: { select: { logs: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, page, limit, pages: Math.ceil(total / limit) || 1, rules },
    });
  } catch (error) {
    console.error("[CRM] automation rules list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/automation/rules — create ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    // .catch(() => null) so a missing/unparseable body is a 400, not a 500.
    const body = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است",
          },
        },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const created = await prisma.automationRule.create({
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        priority: input.priority,
        trigger: input.trigger,
        triggerConfig: input.triggerConfig,
        conditions: input.conditions,
        actions: input.actions,
        // Identity comes only from the verified JWT, never from the body.
        createdById: auth.user.sub,
      },
      include: { createdBy: { select: CREATOR_SELECT } },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    // P2003 — createdById FK: the authenticated user row no longer exists.
    if ((error as { code?: string })?.code === "P2003") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREATOR", message: "کاربر جاری یافت نشد" } },
        { status: 400 }
      );
    }
    console.error("[CRM] automation rule create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

