import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { resolveAdminId } from "@/lib/identity-resolver";
import { validateCsrf } from "@/lib/csrf";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfErr = validateCsrf(req);
  if (csrfErr) return csrfErr;
  try {
    const auth = await requireRole(req, ["admin"]);
    if (auth.response) return auth.response;

    // Phase 5 fix: resolve User.id → Admin.id (Agent.adminId references Admin.id)
    const adminId = await resolveAdminId(auth.user.sub);
    if (!adminId) {
      return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });
    }

    const { id } = await params;
    // Scoped: only delete agents owned by this admin
    const result = await prisma.agent.deleteMany({ where: { id, adminId } });

    if (result.count === 0) {
      return NextResponse.json({ error: "نماینده یافت نشد" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}
