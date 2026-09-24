import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth-guard";
import { getDashboardStats, getTopCustomers } from "@/services/crm/customer.service";

// ─── GET /api/crm/stats — dashboard aggregates ─────
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const [stats, topCustomers] = await Promise.all([
      getDashboardStats(),
      getTopCustomers(5),
    ]);

    return NextResponse.json({ success: true, data: { ...stats, topCustomers } });
  } catch (error) {
    console.error("[CRM] dashboard stats failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
