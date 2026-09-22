import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1, "عنوان تسک الزامی است").max(200),
  description: z.string().optional(),
  cronExpr: z.string().min(1, "عبارت cron الزامی است").max(100),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignedToId: z.string().uuid().optional(),
  nextRunAt: z.string().datetime({ offset: true }).optional(),
});

// ─── GET /api/crm/tasks/recurring ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const items = await prisma.recurringTask.findMany({
      include: { assignedTo: { select: { id: true, fullName: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] recurring list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/tasks/recurring ─────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
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

    // Simple 5-field cron sanity check: "m h dom mon dow"
    const cronFields = input.cronExpr.trim().split(/\s+/);
    if (cronFields.length !== 5) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "عبارت cron باید ۵ فیلد داشته باشد (m h dom mon dow)" } },
        { status: 400 }
      );
    }

    const created = await prisma.recurringTask.create({
      data: {
        title: input.title,
        description: input.description,
        cronExpr: input.cronExpr,
        priority: input.priority,
        assignedToId: input.assignedToId ?? authUser.sub,
        nextRunAt: input.nextRunAt ? new Date(input.nextRunAt) : null,
      },
      include: { assignedTo: { select: { id: true, fullName: true, username: true } } },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] recurring create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
