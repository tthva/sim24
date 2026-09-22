import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { sendSms } from "@/lib/crm/sms-sender";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const postSchema = z.object({
  channel: z.enum(["sms", "call", "note", "chat"]),
  direction: z.enum(["inbound", "outbound"]).default("outbound"),
  subject: z.string().max(200).optional(),
  content: z.string().min(1, "متن پیام الزامی است"),
  durationSec: z.number().int().min(0).optional(),
  templateId: z.string().optional(),
  sendNow: z.boolean().optional().default(false),
});

// ─── GET /api/crm/customers/[id]/communications — per-customer timeline ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const items = await prisma.communication.findMany({
      where: { customerId: id },
      include: { operator: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] customer communications list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/customers/[id]/communications ─────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;
    const authUser = await getCurrentUser(request);
    const operatorId = authUser?.sub;
    if (!operatorId) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "کاربر شناسایی نشد" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const customer = await prisma.customer.findUnique({ where: { id } });
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
    }

    const created = await prisma.communication.create({
      data: {
        customerId: id,
        channel: input.channel,
        direction: input.direction,
        subject: input.subject,
        content: input.content,
        status,
        externalId,
        templateId: input.templateId,
        durationSec: input.durationSec,
        operatorId,
        ...(status === "sent" ? { sentAt: new Date() } : {}),
      },
      include: { operator: { select: { id: true, fullName: true, username: true } } },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] customer communication create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
