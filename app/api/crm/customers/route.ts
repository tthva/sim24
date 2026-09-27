import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { validateCsrf } from "@/lib/csrf";
import { hasViewAllPermission, getCustomerScopeBranches } from "@/lib/crm/scope";
import type { Prisma } from "@prisma/client";
import {
  listCustomers,
  createCustomer,
} from "@/services/crm/customer.service";

// ─── GET /api/crm/customers — list with filters ────────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const sp = request.nextUrl.searchParams;
    const filters = {
      search: sp.get("search") || undefined,
      segment: sp.get("segment") || undefined,
      tag: sp.get("tag") || undefined,
      status: sp.get("status") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      limit: sp.get("limit") ? Number(sp.get("limit")) : 20,
    };

    // Phase 4.8b-2: per-owner scope — without crm.view_all, only own customers.
    const userId = auth.user.sub;
    const canViewAll = await hasViewAllPermission(userId);
    if (canViewAll) {
      const result = await listCustomers(filters);
      return NextResponse.json({ success: true, data: result });
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));

    // Phase 4.8c hardening (D1): ownerless customers (referralAgentId IS NULL)
    // are visible to any user with crm.read; owned rows only to their owner.
    // The scope branches and the search OR are combined with AND so neither
    // overwrites the other (both previously lived in `where.OR`).
    const scopeBranches = await getCustomerScopeBranches(userId);
    const andClauses: Prisma.CustomerWhereInput[] = [{ OR: scopeBranches }];
    if (filters.search) {
      const q = filters.search.trim();
      andClauses.push({
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { primaryPhone: { contains: q } },
          { customerCode: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.CustomerWhereInput = { AND: andClauses };
    if (filters.segment) where.segment = filters.segment;
    if (filters.status) where.status = filters.status;
    if (filters.tag) where.tags = { some: { tag: filters.tag } };
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.to);
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        include: { tags: true, interactions: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, page, limit, pages: Math.ceil(total / limit) || 1, customers },
    });
  } catch (error) {
    console.error("[CRM] listCustomers failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/customers — manual create ───────────
export async function POST(request: NextRequest) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const body = await request.json();
    if (!body.primaryPhone) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "شماره موبایل الزامی است" } },
        { status: 400 }
      );
    }

    const customer = await createCustomer({
      fullName: body.fullName,
      primaryPhone: body.primaryPhone,
      segment: body.segment,
      nationalId: body.nationalId,
      referralAgentId: body.referralAgentId,
    });

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "DUPLICATE_PHONE") {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_PHONE", message: error.message } },
        { status: 409 }
      );
    }
    console.error("[CRM] createCustomer failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: error?.message || "خطای سرور" } },
      { status: 500 }
    );
  }
}
