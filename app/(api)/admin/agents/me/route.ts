import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["admin"]);
    if (auth.response) return auth.response;

    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { adminProfile: true },
    });

    if (!user || !user.adminProfile) return NextResponse.json({ error: "not found" }, { status: 404 });

        return NextResponse.json({ admin: { id: user.id, username: user.username } });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}