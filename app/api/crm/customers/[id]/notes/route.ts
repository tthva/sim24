import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { canViewCustomerData } from "@/lib/crm/scope";
import { listNotes, addNote } from "@/services/crm/customer.service";
import { limitRequest, CRM_WRITE_RATE_LIMIT } from "@/lib/rate-limit-http";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/crm/customers/[id]/notes ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requirePermission(request, "crm.read");
    if (auth.response) return auth.response;

    const { id } = await params;

    // Read-IDOR fix (D-OWNERSHIP): mirror the customer detail/timeline owner
    // scope — previously ANY crm.read user could read any customer's
    // free-text notes by id. GET only; POST scoping comes next session.
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { referralAgentId: true },
    });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    if (!(await canViewCustomerData(auth.user.sub, customer.referralAgentId))) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "دسترسی غیر مجاز" } },
        { status: 403 }
      );
    }

    const notes = await listNotes(id);
    return NextResponse.json({ success: true, data: notes });
  } catch (error) {
    console.error("[CRM] listNotes failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── POST /api/crm/customers/[id]/notes — add note ─────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  // Rate-limit writes per IP (fail-open on Redis outage).
  const rl = await limitRequest(request, CRM_WRITE_RATE_LIMIT, "customer-notes");
  if (rl.limited) return rl.response;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    // Write-IDOR fix (D-WRITE): scope the write by customer owner — 403 on
    // deny (sub-resource, D-403).
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
    if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "متن یادداشت الزامی است" } },
        { status: 400 }
      );
    }

    const authUser = await getCurrentUser(request);
    const note = await addNote(id, body.content.trim(), authUser?.sub ?? null);
    return NextResponse.json({ success: true, data: note }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] addNote failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
