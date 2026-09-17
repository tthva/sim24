// ============================
// SIM24 — Price-expert whitelist management
// GET    /api/price-expert/whitelist  → items
// POST   /api/price-expert/whitelist  → { phone, note? }
// DELETE /api/price-expert/whitelist?phone=09xxxxxxxxx
// ============================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";
import { validateCsrf } from "@/lib/csrf";

const PHONE_RE = /^09\d{9}$/;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(request, ["operator"]);
    if (auth.response) return auth.response;

    const items = await prisma.whitelistPhone.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ success: true, data: { items, suggestions: [] } }, { status: 200 });
  } catch (error: any) {
    console.error("[Whitelist GET] Error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت وایت‌لیست" },
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
    const note = body?.note ? String(body.note).trim().slice(0, 200) : null;
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { success: false, message: "شماره باید ۱۱ رقم و با 09 شروع شود" },
        { status: 400 },
      );
    }

    const item = await prisma.$transaction(async (tx) => {
      // انحصار متقابل: افزودن به وایت‌لیست، آن را از بلک‌لیست حذف می‌کند
      await tx.blacklistPhone.deleteMany({ where: { phone } });
      return tx.whitelistPhone.upsert({
        where: { phone },
        update: { note },
        create: { phone, note, addedById: auth.user.sub },
      });
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error: any) {
    console.error("[Whitelist POST] Error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در افزودن به وایت‌لیست" },
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

    const result = await prisma.whitelistPhone.deleteMany({ where: { phone } });
    return NextResponse.json(
      { success: true, data: { removed: result.count } },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("[Whitelist DELETE] Error:", error);
    return NextResponse.json(
      { success: false, message: "خطا در حذف از وایت‌لیست" },
      { status: 500 },
    );
  }
}
