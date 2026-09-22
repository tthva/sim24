import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().max(200).optional(),
  content: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  category: z.enum(["welcome", "followup", "rejection", "payment", "custom"]).optional(),
  isActive: z.boolean().optional(),
});

// ─── PATCH /api/crm/templates/[id] ─────
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
    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: parsed.data,
      include: { createdBy: { select: { id: true, fullName: true, username: true } } },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قالب یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] template patch failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/templates/[id] — deactivate (soft) ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const updated = await prisma.messageTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, data: { id: updated.id, isActive: false } });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قالب یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] template delete failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
