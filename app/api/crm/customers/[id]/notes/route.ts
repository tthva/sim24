import { NextRequest, NextResponse } from "next/server";
import { requireRole, getCurrentUser } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { listNotes, addNote } from "@/services/crm/customer.service";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/crm/customers/[id]/notes ─────
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
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

  try {
    const auth = await requireRole(request, ["operator", "admin"]);
    if (auth.response) return auth.response;

    const { id } = await params;
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
