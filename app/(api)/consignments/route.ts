import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { validateCsrf } from "@/lib/csrf";

// GET /api/consignments — list all consignment items
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }
    try {
      verifyToken(token);
    } catch {
      return NextResponse.json(
        { success: false, message: "توکن نامعتبر است" },
        { status: 401 }
      );
    }

    const items = await prisma.consignmentItem.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    console.error("GET /api/consignments error:", err);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت لیست امانی" },
      { status: 500 }
    );
  }
}

// POST /api/consignments — add a new consignment item manually
export async function POST(req: NextRequest) {

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }

  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }
    try {
      verifyToken(token);
    } catch {
      return NextResponse.json(
        { success: false, message: "توکن نامعتبر است" },
        { status: 401 }
      );
    }

    const body = await req.json();
    // Ù†Ø±Ù…Ø§Ù„Ø³Ø§Ø²ÛŒ: Ø§Ø±Ù‚Ø§Ù… ÙØ§Ø±Ø³ÛŒ Ø¨Ù‡ Ø§Ù†Ú¯Ù„ÛŒØ³ÛŒØŒ Ø­Ø°ÙÙ Ø­Ø±ÙˆÙ Ùˆ Ú©Ø§Ø±Ø§Ú©ØªØ±Ù‡Ø§ÛŒ ØºÛŒØ±Ø±Ù‚Ù…ÛŒ
    const normalizeMobile = (v: unknown): string =>
      String(v ?? "")
        .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
        .replace(/[^\d]/g, "")
        .slice(0, 11);
    const simNumber = normalizeMobile(body?.simNumber);
    const ownerName = String(body?.ownerName ?? "").trim();
    const phone = normalizeMobile(body?.phone);

    if (!simNumber || !ownerName || !phone) {
      return NextResponse.json(
        { success: false, message: "شماره سیم‌کارت، نام مالک و شماره تماس الزامی است" },
        { status: 400 }
      );
    }
    // Ø´Ù…Ø§Ø±Ù‡ Ù…Ø¹ØªØ¨Ø±: 11 Ø±Ù‚Ù… Ø´Ø±ÙˆØ¹ Ø¨Ø§ 09
    if (!/^09\d{9}$/.test(simNumber) || !/^09\d{9}$/.test(phone)) {
      return NextResponse.json(
        { success: false, message: "شماره سیم‌کارت و شماره تماس باید ۱۱ رقم و با ۰۹ شروع شوند" },
        { status: 400 }
      );
    }

    const price = body?.price != null && String(body.price).trim() !== "" ? String(body.price).trim() : null;
    const notes = body?.notes != null && String(body.notes).trim() !== "" ? String(body.notes).trim() : null;

    const item = await prisma.consignmentItem.create({
      data: {
        simNumber,
        ownerName,
        phone,
        price,
        notes,
        source: "manual",
      },
    });

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (err) {
    console.error("POST /api/consignments error:", err);
    return NextResponse.json(
      { success: false, message: "خطا در افزودن آیتم امانی" },
      { status: 500 }
    );
  }
}