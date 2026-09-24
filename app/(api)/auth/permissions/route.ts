import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserPermissions } from "@/lib/rbac";

// ─── GET /api/auth/permissions — current user's RBAC permission codes ─────
// Phase 4.8d-1: the JWT payload only carries `role`
// (admin | agent | operator | user), which cannot distinguish crm_manager
// from crm_operator. The CRM sidebar calls this endpoint once on mount to
// decide which nav items to render (crm.view_all / crm.manage gates).
// Fail-closed: unauthenticated → 401; lookup error → 500 — the client then
// treats permissions as [] and hides every restricted item.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.response) return auth.response;

    const permissions = await getUserPermissions(auth.user.sub);
    return NextResponse.json({ success: true, data: permissions });
  } catch (error) {
    console.error("[AUTH] permissions lookup failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" },
      },
      { status: 500 }
    );
  }
}