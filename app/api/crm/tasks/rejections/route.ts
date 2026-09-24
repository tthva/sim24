import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

const createSchema = z.object({
  stepInstanceId: z.string().min(1, "شناسه مرحله الزامی است"),
  reasonId: z.string().min(1, "دلیل ریجکت الزامی است"),
  notes: z.string().optional(),
  attachments: z.array(z.string()).default([]),
});

// ─── GET /api/crm/tasks/rejections?stepInstanceId= ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const stepInstanceId = request.nextUrl.searchParams.get("stepInstanceId");
    const items = await prisma.taskRejection.findMany({
      where: stepInstanceId ? { stepInstanceId } : undefined,
      include: {
        reason: { select: { code: true, name: true, category: true } },
        rejectedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { rejectedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] task rejections list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/tasks/rejections — record a step rejection ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;
    const authUser = await getCurrentUser(request);
    if (!authUser?.sub) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "کاربر شناسایی نشد" } },
        { status: 401 }
      );
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }
    const input = parsed.data;

    const reason = await prisma.rejectionReason.findUnique({ where: { id: input.reasonId } });
    if (!reason || !reason.isActive) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "دلیل ریجکت نامعتبر یا غیرفعال است" } },
        { status: 400 }
      );
    }
    if (reason.code === "other" && !input.notes?.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "برای «سایر» توضیحات الزامی است" } },
        { status: 400 }
      );
    }

    const created = await prisma.taskRejection.create({
      data: {
        stepInstanceId: input.stepInstanceId,
        reasonId: input.reasonId,
        notes: input.notes,
        attachments: input.attachments,
        rejectedById: authUser.sub,
      },
      include: {
        reason: { select: { code: true, name: true, category: true } },
        rejectedBy: { select: { id: true, fullName: true, username: true } },
      },
    });

    // Step status -> REJECTED (best-effort; workflow completion is the source of truth)
    try {
      await prisma.workflowStepInstance.updateMany({
        where: { id: input.stepInstanceId, status: { not: "REJECTED" } },
        data: { status: "REJECTED" },
      });
    } catch (e) {
      console.warn("[CRM] step status update skipped:", e);
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] task rejection create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
