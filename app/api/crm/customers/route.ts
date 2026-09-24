import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
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
    const result = await listCustomers({
      search: sp.get("search") || undefined,
      segment: sp.get("segment") || undefined,
      tag: sp.get("tag") || undefined,
      status: sp.get("status") || undefined,
      from: sp.get("from") || undefined,
      to: sp.get("to") || undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      limit: sp.get("limit") ? Number(sp.get("limit")) : 20,
    });

    return NextResponse.json({ success: true, data: result });
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
