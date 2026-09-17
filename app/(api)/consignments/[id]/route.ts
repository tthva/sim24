import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { validateCsrf } from "@/lib/csrf";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/consignments/[id] — single consignment item
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }
    let actorId: string;
    try {
      const payload = await verifyToken(token);
      actorId = payload.sub;
    } catch {
      return NextResponse.json(
        { success: false, message: "توکن نامعتبر است" },
        { status: 401 }
      );
    }

    const { id } = await params;
    // Soft-deleted items (and sold/reserved items, which are soft-deleted on
    // transition) must not be openable — return 404. Requiring status=available
    // also covers legacy rows that were sold before the soft-delete invariant.
    const item = await prisma.consignmentItem.findFirst({
      where: { id, deletedAt: null, status: "available" },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, message: "آیتم امانی یافت نشد" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item, actorId });
  } catch (err) {
    console.error("GET /api/consignments/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "خطا در دریافت آیتم امانی" },
      { status: 500 }
    );
  }
}

// PATCH /api/consignments/[id] — update duration / status / notes
export async function PATCH(req: NextRequest, { params }: RouteContext) {

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }
    let actorId: string;
    try {
      const payload = await verifyToken(token);
      actorId = payload.sub;
    } catch {
      return NextResponse.json(
        { success: false, message: "توکن نامعتبر است" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await prisma.consignmentItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "آیتم امانی یافت نشد" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const data: { duration?: number; status?: string; notes?: string | null; price?: string | null; deletedAt?: Date | null } = {};

    if (body?.duration !== undefined) {
      const d = Number(body.duration);
      if (!Number.isInteger(d) || d <= 0) {
        return NextResponse.json(
          { success: false, message: "مدت امانت باید عددی بزرگ‌تر از صفر باشد" },
          { status: 400 }
        );
      }
      data.duration = d;
    }

    if (body?.status !== undefined) {
      const s = String(body.status);
      if (!["available", "reserved", "sold"].includes(s)) {
        return NextResponse.json(
          { success: false, message: "وضعیت نامعتبر است" },
          { status: 400 }
        );
      }
      data.status = s;
      // وضعیت «کنسل» یا «فروش رفته» → حذف نرم (از لیست پنهان می‌شود)
      if (s === "reserved" || s === "sold") {
        data.deletedAt = new Date();
      } else if (s === "available") {
        // بازگشت به موجود: حذف نرم را برمی‌گرداند
        data.deletedAt = null;
      }
    }

    if (body?.price !== undefined) {
      const p = String(body.price ?? "").replace(/[^\d]/g, "");
      if (p === "") {
        data.price = null;
      } else {
        const n = Number(p);
        if (!Number.isFinite(n) || n <= 0) {
          return NextResponse.json(
            { success: false, message: "قیمت نامعتبر است" },
            { status: 400 }
          );
        }
        data.price = String(n);
      }
    }

    if (body?.notes !== undefined) {
      const n = String(body.notes ?? "").trim();
      data.notes = n === "" ? null : n;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "هیچ تغییری ارسال نشده است" },
        { status: 400 }
      );
    }

    const item = await prisma.consignmentItem.update({ where: { id }, data });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          entity: "consignment_item",
          entityId: id,
          action: "UPDATE",
          metadata: { updated: Object.keys(data), duration: item.duration, status: item.status },
        },
      });
    } catch (auditErr) {
      console.error("Audit log failed for consignment update:", auditErr);
    }

    return NextResponse.json({ success: true, data: item });
  } catch (err) {
    console.error("PATCH /api/consignments/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "خطا در بروزرسانی آیتم امانی" },
      { status: 500 }
    );
  }
}

// DELETE /api/consignments/[id] — soft delete (sets deletedAt, keeps the row)
export async function DELETE(req: NextRequest, { params }: RouteContext) {

  { const __csrf = validateCsrf(req); if (__csrf) return __csrf; }
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "احراز هویت لازم است" },
        { status: 401 }
      );
    }
    let actorId: string;
    try {
      const payload = await verifyToken(token);
      actorId = payload.sub;
    } catch {
      return NextResponse.json(
        { success: false, message: "توکن نامعتبر است" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await prisma.consignmentItem.findFirst({ where: { id, deletedAt: null } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "آیتم امانی یافت نشد" },
        { status: 404 }
      );
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          entity: "consignment_item",
          entityId: id,
          action: "DELETE",
          metadata: { softDelete: true, simNumber: existing.simNumber, ownerName: existing.ownerName, source: existing.source },
        },
      });
    } catch (auditErr) {
      console.error("Audit log failed for consignment delete:", auditErr);
    }

    // حذف نرم — ردیف حفظ می‌شود و فقط از لیست‌ها پنهان می‌گردد
    const item = await prisma.consignmentItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: { id: item.id, deletedAt: item.deletedAt } });
  } catch (err) {
    console.error("DELETE /api/consignments/[id] error:", err);
    return NextResponse.json(
      { success: false, message: "خطا در حذف آیتم امانی" },
      { status: 500 }
    );
  }
}
