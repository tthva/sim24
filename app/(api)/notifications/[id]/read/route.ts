import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";

export async function POST(request: NextRequest, context: any) {

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }
  try {
    const auth = await requireRole(request, ["agent"]);
    if (auth.response) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { agentProfile: true },
    });

    const agentId = user?.agentProfile?.id;
    if (!agentId) return NextResponse.json({ message: "یافت نشد" }, { status: 404 });

    const notificationId = context?.params?.id;
    if (!notificationId) return NextResponse.json({ message: "آیدی نامعتبر" }, { status: 400 });

    await (prisma as any).notification.updateMany({
      where: { id: notificationId, agentId },
      data: { read: true },
    });

    return NextResponse.json({ message: "با موفقیت خوانده شد" }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}