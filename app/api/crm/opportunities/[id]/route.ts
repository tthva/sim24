import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { updateLeadScore } from "@/lib/crm/lead-scoring";
import { scheduleTrigger } from "@/lib/crm/automation-engine";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  estimatedValue: z.number().nonnegative().nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  expectedCloseAt: z.string().datetime({ offset: true }).nullable().optional(),
  stageId: z.string().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

const INCLUDE = {
  customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true, score: true } },
  stage: true,
  pipeline: true,
  assignedTo: { select: { id: true, fullName: true, username: true } },
  rejectionReason: true,
};

// ─── GET /api/crm/opportunities/[id] ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;
    const item = await prisma.opportunity.findUnique({ where: { id }, include: INCLUDE });
    if (!item) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "فرصت یافت نشد" } },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error("[CRM] opportunity detail failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/crm/opportunities/[id] — edit / move stage ─────
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
    const d = parsed.data;

    const existing = await prisma.opportunity.findUnique({
      where: { id },
      include: { stage: true, pipeline: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "فرصت یافت نشد" } },
        { status: 404 }
      );
    }

    // If stageId changes, validate it belongs to the same pipeline + set won/lost
    const data: Record<string, unknown> = { ...d };
    if (d.expectedCloseAt === null) data.expectedCloseAt = null;
    else if (d.expectedCloseAt) data.expectedCloseAt = new Date(d.expectedCloseAt);
    if (d.stageId && d.stageId !== existing.stageId) {
      const stage = await prisma.pipelineStage.findUnique({ where: { id: d.stageId } });
      if (!stage || stage.pipelineId !== existing.pipelineId) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "مرحله به این پایپ‌لاین تعلق ندارد" } },
          { status: 400 }
        );
      }
      if (stage.isWon) data.wonAt = new Date();
      if (stage.isLost) data.lostAt = new Date();
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data,
      include: INCLUDE,
    });

    // Non-blocking lead score refresh
    updateLeadScore(existing.customerId).catch(() => {});

    // CRM Phase 4.7f: fire stage_changed ONLY on a real stage transition. The
    // guard compares the pre-update stage (`existing`, read before the update)
    // with the requested one, so re-sending the same stageId is a no-op and does
    // not emit a trigger. Fire-and-forget — never awaited, so it cannot block or
    // fail this response.
    if (d.stageId && existing.stageId !== d.stageId) {
      scheduleTrigger({
        type: "stage_changed",
        entityType: "opportunity",
        entityId: id,
        data: {
          opportunityId: id,
          customerId: updated.customerId,
          fromStage: existing.stageId,
          toStage: d.stageId,
        },
      });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "فرصت یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] opportunity patch failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/opportunities/[id] — soft delete (lost marker) ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    const updated = await prisma.opportunity.update({
      where: { id },
      data: { lostAt: new Date(), title: "— حذف‌شده —" },
      select: { id: true, customerId: true },
    });
    updateLeadScore(updated.customerId).catch(() => {});
    return NextResponse.json({ success: true, data: { id: updated.id, deleted: true } });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "فرصت یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] opportunity delete failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
