import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
});

// ─── GET /api/crm/tasks/[id] ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const item = await prisma.activity.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, fullName: true, username: true } },
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
      },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "تسک یافت نشد" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("[CRM] task detail failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/crm/tasks/[id] — mark complete / change priority ─────
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
    if (parsed.data.status === "completed") data.completedAt = new Date();
    if (parsed.data.status === "pending") data.completedAt = null;
    if (parsed.data.dueAt === null) data.dueAt = null;
    else if (parsed.data.dueAt) data.dueAt = new Date(parsed.data.dueAt);

    const updated = await prisma.activity.update({
      where: { id },
      data,
      include: {
        assignedTo: { select: { id: true, fullName: true, username: true } },
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "تسک یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] task patch failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/tasks/[id] — cancel (soft) ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
    const updated = await prisma.activity.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ success: true, data: { id: updated.id, status: "cancelled" } });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "تسک یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] task delete failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
