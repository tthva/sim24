// ============================
// SIM24 — Price-expert blacklist management
// GET    /api/price-expert/blacklist  → items + auto-block suggestions
// POST   /api/price-expert/blacklist  → { phone, reason? }
// DELETE /api/price-expert/blacklist?phone=09xxxxxxxxx
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { getBlockSuggestions } from "@/lib/phone-risk";
import { validateCsrf } from "@/lib/csrf";

const PHONE_RE = /^09\d{9}$/;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator"]);
    if (auth.response) return auth.response;

    const [items, suggestions] = await Promise.all([
      prisma.blacklistPhone.findMany({ orderBy: { createdAt: "desc" } }),
      getBlockSuggestions(),
    ]);
    return NextResponse.json({ success: true, data: { items, suggestions } }, { status: 200 });
  } catch (error: any) {
    console.error("[Blacklist GET] Error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت بلک‌لیست" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }
  try {
    const auth = await requireRole(request, ["operator"]);
    if (auth.response) return auth.response;

    const body = await request.json().catch(() => null);
    const phone = String(body?.phone ?? "").trim();
    const reason = body?.reason ? String(body.reason).trim().slice(0, 200) : null;
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { success: false, message: "شماره باید ۱۱ رقم و با 09 شروع شود" },
        { status: 400 },
      );
    }

    const item = await prisma.$transaction(async (tx) => {
      // انحصار متقابل: افزودن به بلک‌لیست، آن را از وایت‌لیست حذف می‌کند
      await tx.whitelistPhone.deleteMany({ where: { phone } });
      return tx.blacklistPhone.upsert({
        where: { phone },
        update: { reason },
        create: { phone, reason, addedById: auth.user.sub },
      });
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    console.error("[Blacklist POST] Error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در افزودن به بلک‌لیست" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }

  { const __csrf = validateCsrf(request); if (__csrf) return __csrf; }
  try {
    const auth = await requireRole(request, ["operator"]);
    if (auth.response) return auth.response;

    const phone = request.nextUrl.searchParams.get("phone")?.trim() ?? "";
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { success: false, message: "شماره باید ۱۱ رقم و با 09 شروع شود" },
        { status: 400 },
      );
    }

    const result = await prisma.blacklistPhone.deleteMany({ where: { phone } });
    return NextResponse.json(
      { success: true, data: { removed: result.count } },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Blacklist DELETE] Error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف از بلک‌لیست" },
      { status: 500 },
    );
  }
}
