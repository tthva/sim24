import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";
import { addTag, removeTag } from "@/services/crm/customer.service";

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/crm/customers/[id]/tags — add tag ─────
export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    const body = await request.json();
    if (!body.tag || typeof body.tag !== "string" || !body.tag.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "نام تگ الزامی است" } },
        { status: 400 }
      );
    }

    const tag = await addTag(id, body.tag.trim(), body.color);
    return NextResponse.json({ success: true, data: tag }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "مشتری یافت نشد" } },
        { status: 404 }
      );
    }
    console.error("[CRM] addTag failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/crm/customers/[id]/tags?tag=... — remove tag ─────
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfErr = validateCsrf(request);
  if (csrfErr) return csrfErr;

  try {
    const auth = await requirePermission(request, "crm.manage");
    if (auth.response) return auth.response;

    const { id } = await params;
    const tag = request.nextUrl.searchParams.get("tag");
    if (!tag) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "پارامتر tag الزامی است" } },
        { status: 400 }
      );
    }

    await removeTag(id, tag);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CRM] removeTag failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "خطای سرور" } },
      { status: 500 }
    );
  }
}
