import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { updateLeadScore } from "@/lib/crm/lead-scoring";
import { z } from "zod";

const listQuerySchema = z.object({
  pipeline: z.string().optional(),
  stage: z.string().optional(),
  assignedTo: z.string().optional(),
  customerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  title: z.string().min(1, "عنوان فرصت الزامی است").max(200),
  description: z.string().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseAt: z.string().datetime({ offset: true }).optional(),
  assignedToId: z.string().uuid().optional(),
  workflowInstanceId: z.string().optional(),
  customerFormId: z.string().optional(),
});

// ─── GET /api/crm/opportunities ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "پارامترها نامعتبر است" } },
        { status: 400 }
      );
    }
    const { pipeline, stage, assignedTo, customerId, limit } = parsed.data;

    const items = await prisma.opportunity.findMany({
      where: {
        ...(pipeline ? { pipelineId: pipeline } : {}),
        ...(stage ? { stageId: stage } : {}),
        ...(assignedTo ? { assignedToId: assignedTo } : {}),
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true, score: true } },
        stage: true,
        assignedTo: { select: { id: true, fullName: true, username: true } },
        rejectionReason: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit ?? 200,
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] opportunities list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/opportunities ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;
    const authUser = await getCurrentUser(request);

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // Validate stage belongs to the pipeline
    const stage = await prisma.pipelineStage.findUnique({ where: { id: input.stageId } });
    if (!stage || stage.pipelineId !== input.pipelineId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "مرحله به این پایپ‌لاین تعلق ندارد" } },
        { status: 400 }
      );
    }

    const created = await prisma.opportunity.create({
      data: {
        customerId: input.customerId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        title: input.title,
        description: input.description,
        estimatedValue: input.estimatedValue,
        probability: input.probability,
        expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
        assignedToId: input.assignedToId ?? authUser?.sub ?? null,
        workflowInstanceId: input.workflowInstanceId,
        customerFormId: input.customerFormId,
      },
      include: {
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true, score: true } },
        stage: true,
        assignedTo: { select: { id: true, fullName: true, username: true } },
      },
    });

    // Non-blocking lead score refresh
    updateLeadScore(input.customerId).catch(() => {});

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] opportunity create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
