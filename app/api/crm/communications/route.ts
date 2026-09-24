import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { sendSms } from "@/lib/crm/sms-sender";
import { logActivity } from "@/lib/crm/activity-logger";
import { scheduleTrigger } from "@/lib/crm/automation-engine";
import { z } from "zod";

const listQuerySchema = z.object({
  channel: z.enum(["sms", "call", "note", "chat"]).optional(),
  customerId: z.string().optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  customerId: z.string().min(1, "شناسه مشتری الزامی است"),
  channel: z.enum(["sms", "call", "note", "chat"]),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  subject: z.string().max(200).optional(),
  content: z.string().min(1, "متن پیام الزامی است"),
  durationSec: z.number().int().min(0).optional(),
  templateId: z.string().optional(),
  sendNow: z.boolean().optional().default(false),
  relatedTaskId: z.string().uuid().optional(),
});

// ─── GET /api/crm/communications ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
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
    const { channel, customerId, direction, limit } = parsed.data;

    const items = await prisma.communication.findMany({
      where: {
        ...(channel ? { channel } : {}),
        ...(customerId ? { customerId } : {}),
        ...(direction ? { direction } : {}),
      },
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
        operator: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit ?? 50,
    });

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] communications list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/communications — create + optional immediate SMS ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;
    const authUser = await getCurrentUser(request);
    const operatorId = authUser?.sub;
    if (!operatorId) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "کاربر شناسایی نشد" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }

    let externalId: string | null = null;
    let status = "pending";

    if (input.channel === "sms" && input.direction === "outbound" && input.sendNow) {
      const sms = await sendSms(customer.primaryPhone, input.content, input.templateId);
      externalId = sms.externalId ?? null;
      status = sms.success ? "sent" : "failed";
      if (!sms.success) {
        console.warn("[CRM] SMS send failed (communication still recorded):", sms.error);
      }
    }

    const created = await prisma.communication.create({
      data: {
        customerId: input.customerId,
        channel: input.channel,
        direction: input.direction,
        subject: input.subject,
        content: input.content,
        status,
        externalId,
        templateId: input.templateId,
        durationSec: input.durationSec,
        relatedTaskId: input.relatedTaskId,
        operatorId,
        ...(status === "sent" ? { sentAt: new Date() } : {}),
      },
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
        operator: { select: { id: true, fullName: true, username: true } },
      },
    });

    // Non-fatal: log an activity entry for follow-up traceability
    await logActivity({
      customerId: input.customerId,
      type: input.channel === "call" ? "call" : "followup",
      title: `${input.channel.toUpperCase()} ${input.direction === "inbound" ? "دریافتی" : "ارسالی"}`,
      description: input.content.slice(0, 200),
      assignedToId: operatorId,
    }).catch(() => null);

    // CRM Phase 4.7f: fire-and-forget automation trigger. scheduleTrigger is
    // synchronous (setTimeout(0)) and never throws, so it can neither block nor
    // fail this response. Rules that only care about inbound traffic can filter
    // with a condition on `direction`.
    scheduleTrigger({
      type: "communication_received",
      entityType: "customer",
      entityId: created.customerId,
      data: {
        communicationId: created.id,
        customerId: created.customerId,
        channel: created.channel,
        direction: created.direction,
        content: created.content.slice(0, 200),
      },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] communication create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
