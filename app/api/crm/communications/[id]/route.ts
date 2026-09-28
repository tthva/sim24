import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { canViewCustomerData } from "@/lib/crm/scope";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["pending", "sent", "delivered", "failed", "read"]).optional(),
  subject: z.string().max(200).optional(),
  content: z.string().min(1).optional(),
});

// ─── GET /api/crm/communications/[id] ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;
    const item = await prisma.communication.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true, referralAgentId: true } },
        operator: { select: { id: true, fullName: true, username: true } },
      },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    // Read-IDOR fix (D-OWNERSHIP): mirror the /communications list scope
    // (customer.referralAgentId = caller's agent). 404 — not 403 — on deny,
    // so the endpoint does not confirm the resource exists.
    if (!(await canViewCustomerData(auth.user.sub, item.customer?.referralAgentId ?? null))) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    const { customer: _customer, ...data } = item;
    return NextResponse.json({ success: true, data: { ...data, customer: _customer } });
  } catch (error) {
    console.error("[CRM] communication detail failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/crm/communications/[id] — update status/content ─────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    // Write-IDOR fix (D-WRITE): mirror the /communications list scope —
    // resolve the comm's customer and apply the owner rule. 404 on deny
    // (single-resource, no existence leak, D-404).
    const existing = await prisma.communication.findUnique({
      where: { id },
      select: { customer: { select: { referralAgentId: true } } },
    });
    if (
      !existing ||
      !(await canViewCustomerData(auth.user.sub, existing.customer?.referralAgentId ?? null))
    ) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "delivered") data.deliveredAt = new Date();
    if (parsed.data.status === "read") data.readAt = new Date();

    const updated = await prisma.communication.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true } },
        operator: { select: { id: true, fullName: true, username: true } },
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] communication patch failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/communications/[id] — soft delete (mark failed+hidden) ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    // Write-IDOR fix (D-WRITE): same customer-owner scope as PATCH above.
    const existing = await prisma.communication.findUnique({
      where: { id },
      select: { customer: { select: { referralAgentId: true } } },
    });
    if (
      !existing ||
      !(await canViewCustomerData(auth.user.sub, existing.customer?.referralAgentId ?? null))
    ) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    // Soft delete: keep the audit trail, hide from timelines via subject marker
    const deleted = await prisma.communication.update({
      where: { id },
      data: { status: "failed", subject: "— deleted —" },
    });
    return NextResponse.json({ success: true, data: { id: deleted.id, deleted: true } });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] communication delete failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
