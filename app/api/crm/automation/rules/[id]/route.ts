import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

// Trigger / operator / action allow-lists mirror the collection route
// (app/api/crm/automation/rules/route.ts). Route files own their schemas in this
// codebase, so they are duplicated on purpose rather than extracted — a shared
// module would mean adding another lib file.
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

// .catchall(z.any()), not .passthrough() — Prisma's Json input type rejects the
// `unknown` values that .passthrough() infers. See the collection route.
const actionsSchema = z.array(
  z.object({ type: z.enum(ACTION_VALUES) }).catchall(z.any())
);

// updateSchema is written out explicitly instead of `createSchema.partial()`.
// Measured on zod 4.4.3:
//   z.object({ isActive: z.boolean().default(true) }).partial().parse({})
//     -> { isActive: true }
// Defaults still fire through .partial(), so a PATCH that only renamed a rule
// would silently reset isActive -> true and priority -> 0. Every field here is
// optional with NO default.
const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  trigger: z.enum(TRIGGER_VALUES).optional(),
  triggerConfig: z.record(z.string(), z.any()).optional(),
  conditions: conditionsSchema.optional(),
  actions: actionsSchema.optional(),
});

const DETAIL_INCLUDE = {
  createdBy: { select: { id: true, fullName: true, username: true } },
  logs: { orderBy: { createdAt: "desc" }, take: 20 },
} as const;

// ─── GET /api/crm/automation/rules/[id] — rule + last 20 logs ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!rule) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: rule });
  } catch (error) {
    console.error("[CRM] automation rule detail failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/crm/automation/rules/[id] — partial update ─────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
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
    // Explicit, because an empty update would otherwise be a silent no-op that
    // still bumps updatedAt via @updatedAt.
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "هیچ فیلدی برای بروزرسانی ارسال نشده است" } },
        { status: 400 }
      );
    }

    const updated = await prisma.automationRule.update({
      where: { id },
      data: parsed.data,
      include: DETAIL_INCLUDE,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    // P2025 — rule does not exist.
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] automation rule patch failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/automation/rules/[id] — delete + cascade logs ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.automationRule.findUnique({
      where: { id },
      select: { id: true, _count: { select: { logs: true } } },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }

    // AutomationLog.rule declares onDelete: Cascade, so execution history is
    // removed with the rule. The count is reported back for auditability.
    await prisma.automationRule.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      data: { id: existing.id, logsDeleted: existing._count.logs },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] automation rule delete failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

