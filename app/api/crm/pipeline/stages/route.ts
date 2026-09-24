import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

const createSchema = z.object({
  pipelineId: z.string().min(1),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  order: z.number().int().min(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

// ─── GET /api/crm/pipeline/stages?pipelineId= ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const pipelineId = request.nextUrl.searchParams.get("pipelineId");
    const stages = await prisma.pipelineStage.findMany({
      where: pipelineId ? { pipelineId } : undefined,
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ success: true, data: stages });
  } catch (error) {
    console.error("[CRM] stages list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/pipeline/stages ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }
    const created = await prisma.pipelineStage.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE", message: "کد مرحله در این پایپ‌لاین تکراری است" } },
        { status: 409 }
      );
    }
    console.error("[CRM] stage create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
