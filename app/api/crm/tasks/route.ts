import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { z } from "zod";

const listQuerySchema = z.object({
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  mine: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  customerId: z.string().uuid().optional(),
  type: z.enum(["call", "meeting", "note", "followup"]),
  title: z.string().min(1, "عنوان تسک الزامی است").max(200),
  description: z.string().optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  assignedToId: z.string().uuid().optional(),
});

// ─── GET /api/crm/tasks ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "پارامترهای جستجو نامعتبر است" } },
        { status: 400 }
      );
    }
    const { status, priority, assignedTo, mine, limit } = parsed.data;

    const authUser = await getCurrentUser(request);
    const items = await prisma.activity.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(assignedTo ? { assignedToId: assignedTo } : {}),
        ...(mine === "true" && authUser?.sub ? { assignedToId: authUser.sub } : {}),
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, username: true } },
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: limit ?? 100,
    });
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error("[CRM] tasks list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/tasks — create manual task ─────
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

    const created = await prisma.activity.create({
      data: {
        customerId: input.customerId,
        type: input.type,
        title: input.title,
        description: input.description,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority,
        assignedToId: input.assignedToId ?? authUser.sub,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true, username: true } },
        customer: { select: { id: true, fullName: true, primaryPhone: true, customerCode: true } },
      },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error("[CRM] task create failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
