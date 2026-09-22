import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

const createSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z0-9_]+$/, "کد فقط حروف لاتین کوچک و _"),
  name: z.string().min(1, "نام دلیل الزامی است").max(100),
  category: z.enum(["pricing", "quality", "customer", "other"]).default("other"),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

// ─── GET /api/crm/rejection-reasons ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const all = request.nextUrl.searchParams.get("all") === "true";
    const reasons = await prisma.rejectionReason.findMany({
      where: all ? undefined : { isActive: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ success: true, data: reasons });
  } catch (error) {
    console.error("[CRM] rejection-reasons list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/rejection-reasons — create custom reason ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است" } },
        { status: 400 }
      );
    }

    const created = await prisma.rejectionReason.create({
      data: {
        ...parsed.data,
        isSystem: false, // custom reasons are never system
        order: parsed.data.order ?? 100,
      },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE", message: "این کد قبلاً ثبت شده است" } },
        { status: 409 }
      );
    }
    console.error("[CRM] rejection-reason create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// getCurrentUser kept imported for parity with other routes; used if audit fields are added later
void getCurrentUser;
