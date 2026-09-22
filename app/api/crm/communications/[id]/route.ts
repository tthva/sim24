import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
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
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const item = await prisma.communication.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
        operator: { select: { id: true, fullName: true, username: true } },
      },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "پیام یافت نشد" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
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
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
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
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
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
