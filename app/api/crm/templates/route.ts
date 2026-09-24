import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "نام قالب الزامی است").max(100),
  channel: z.enum(["sms", "email"]),
  subject: z.string().max(200).optional(),
  content: z.string().min(1, "متن قالب الزامی است"),
  variables: z.array(z.string()).default([]),
  category: z.enum(["welcome", "followup", "rejection", "payment", "custom"]).optional(),
  isActive: z.boolean().default(true),
});

// ─── GET /api/crm/templates ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const channel = request.nextUrl.searchParams.get("channel");
    const category = request.nextUrl.searchParams.get("category");
    const items = await prisma.messageTemplate.findMany({
      where: {
        ...(channel ? { channel } : {}),
        ...(category ? { category } : {}),
      },
      include: { createdBy: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] templates list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/templates ─────
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

    const created = await prisma.messageTemplate.create({
      data: {
        name: parsed.data.name,
        channel: parsed.data.channel,
        subject: parsed.data.subject,
        content: parsed.data.content,
        variables: parsed.data.variables,
        category: parsed.data.category,
        isActive: parsed.data.isActive,
        createdById: authUser.sub,
      },
      include: { createdBy: { select: { id: true, fullName: true, username: true } } },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] template create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
