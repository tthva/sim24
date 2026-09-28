import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { hasViewAllPermission, canViewCustomer, canViewCustomerData } from "@/lib/crm/scope";
import {
  getCustomerById,
  updateCustomer,
  softDeleteCustomer,
} from "@/services/crm/customer.service";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/crm/customers/[id] — full 360 payload ────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;
    const customer = await getCustomerById(id);
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }

    // Ownership scope (D1): without crm.view_all a user may read only
    // ownerless customers (referralAgentId IS NULL) or ones they own.
    // Mirrors the list endpoint and the timeline feed via lib/crm/scope.ts.
    const userId = auth.user.sub;
    const canViewAll = await hasViewAllPermission(userId);
    if (!canViewAll && !(await canViewCustomer(userId, customer.referralAgentId))) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "دسترسی غیر مجاز" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    console.error("[CRM] getCustomer failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/crm/customers/[id] — update fields ─────
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;

    // Write-IDOR fix (D-WRITE): previously any crm.manage user could edit
    // any customer. Apply the owner scope — 403 (not 404) since the id is
    // already known via the path (D-403).
    const target = await prisma.customer.findUnique({
      where: { id },
      select: { referralAgentId: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    if (!(await canViewCustomerData(auth.user.sub, target.referralAgentId))) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "دسترسی غیر مجاز" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const customer = await updateCustomer(id, {
      fullName: body.fullName,
      secondaryPhone: body.secondaryPhone,
      nationalId: body.nationalId,
      segment: body.segment,
      score: typeof body.score === "number" ? body.score : undefined,
    });
    return NextResponse.json({ success: true, data: customer });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] updateCustomer failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/customers/[id] — soft delete ──────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;

    // Write-IDOR fix (D-WRITE): same owner scope as PATCH above.
    const target = await prisma.customer.findUnique({
      where: { id },
      select: { referralAgentId: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    if (!(await canViewCustomerData(auth.user.sub, target.referralAgentId))) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "دسترسی غیر مجاز" } },
        { status: 403 }
      );
    }

    const customer = await softDeleteCustomer(id);
    return NextResponse.json({ success: true, data: customer });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] softDeleteCustomer failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
