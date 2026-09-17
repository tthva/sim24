import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";

export async function POST(req: NextRequest) {

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }
  try {
    const auth = await requireRole(req, ["admin"]);
    if (auth.response) return auth.response;

    const { username, password } = await req.json();
    if (!username || !password || password.length < 4) {
      return NextResponse.json({ error: "نام کاربری و رمز عبور (حداقل ۴ کاراکتر) الزامی است" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json({ error: "این نام کاربری قبلاً ثبت شده" }, { status: 409 });
    }

    // Find the admin's Admin record
    const adminUser = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { adminProfile: true },
    });
    if (!adminUser?.adminProfile) {
      return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });
    }

    // Create user + agent in transaction
    const hashed = await hashPassword(password);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          password: hashed,
          userType: "AGENT",
          active: true,
        },
      });
      const agent = await tx.agent.create({
        data: {
          userId: user.id,
          department: adminUser.adminProfile!.department,
          adminId: adminUser.adminProfile!.id,
          active: true,
        },
      });
      return { id: agent.id, username: user.username, createdAt: user.createdAt };
    });

    return NextResponse.json({ success: true, agent: result });
  } catch (e) {
    console.error("Create agent error:", e);
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ["admin"]);
    if (auth.response) return auth.response;

    // Find agents managed by this admin
    const adminUser = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { adminProfile: true },
    });
    if (!adminUser?.adminProfile) {
      return NextResponse.json({ error: "ادمین یافت نشد" }, { status: 404 });
    }

    const agents = await prisma.agent.findMany({
      where: { adminId: adminUser.adminProfile.id },
      include: {
        user: { select: { id: true, username: true, fullName: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      agents: agents.map((a) => ({
        id: a.id,
        username: a.user.username,
        fullName: a.user.fullName,
        createdAt: a.user.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "خطای سرور" }, { status: 500 });
  }
}