import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/crm/automation/rules/[id]/toggle — flip isActive ─────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;

    const existing = await prisma.automationRule.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }

    const nextIsActive = !existing.isActive;
    const updated = await prisma.automationRule.update({
      where: { id },
      data: { isActive: nextIsActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, isActive: updated.isActive },
    });
  } catch (error: unknown) {
    // P2025 — deleted between the read and the write.
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "قانون اتوماسیون یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] automation rule toggle failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
