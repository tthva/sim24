import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { z } from "zod";

// Query params:
//   ruleId  optional exact match
//   success optional boolean. Declared as an enum because z.coerce.boolean()
//           would map ANY non-empty string — including "false" — to true.
//   from/to optional timestamp range. `to` is inclusive of the exact instant,
//           so pass 2026-09-22T23:59:59 to cover a whole day (same semantics as
//           listCustomers in services/crm/customer.service.ts).
const listQuerySchema = z.object({
  ruleId: z.string().optional(),
  success: z.enum(["true", "false"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ─── GET /api/crm/automation/logs — list execution log ─────
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
    const { ruleId, success, from, to, page, limit } = parsed.data;

    const where = {
      ...(ruleId ? { ruleId } : {}),
      ...(success !== undefined ? { success: success === "true" } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.automationLog.count({ where }),
      prisma.automationLog.findMany({
        where,
        include: { rule: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, page, limit, pages: Math.ceil(total / limit) || 1, logs },
    });
  } catch (error) {
    console.error("[CRM] automation logs list failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
