import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { getQueueStats } from "@/lib/queue";

// ─── GET /api/admin/queue — background queue health snapshot ─────
// Exposes getQueueStats() for admin monitoring: backend (redis|memory),
// waiting/active/completed/failed counters and registered handlers.
// Failed jobs beyond the bounded dead-letter history (100) are gone; the
// `failed` counter still reports the lifetime total for this process.
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "دسترسی غیرمجاز" }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: getQueueStats() });
  } catch {
    return NextResponse.json({ message: "خطای سرور" }, { status: 500 });
  }
}
