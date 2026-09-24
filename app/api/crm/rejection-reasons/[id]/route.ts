import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(["pricing", "quality", "customer", "other"]).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// ─── GET /api/crm/rejection-reasons/[id] ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;
    const item = await prisma.rejectionReason.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "دلیل یافت نشد" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("[CRM] rejection-reason detail failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/crm/rejection-reasons/[id] ─────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }
    const updated = await prisma.rejectionReason.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "دلیل یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] rejection-reason patch failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/rejection-reasons/[id] — deactivate (only !isSystem) ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    const existing = await prisma.rejectionReason.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "دلیل یافت نشد" } },
        { status: 404 }
      );
    }
    if (existing.isSystem) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "دلایل سیستمی قابل حذف نیستند" } },
        { status: 403 }
      );
    }
    const updated = await prisma.rejectionReason.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, data: { id: updated.id, isActive: false } });
  } catch (error) {
    console.error("[CRM] rejection-reason delete failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
