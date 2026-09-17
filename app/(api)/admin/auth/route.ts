import { NextRequest, NextResponse } from "next/server";

// ─── DEPRECATED ────────────────────────────────────────────────
// This endpoint is deprecated. Use /api/operator/auth instead.
// It's kept as a redirect wrapper for backward compatibility.
// Rate limiting is handled by the canonical /api/operator/auth endpoint.
// ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Forward to unified operator auth — no rate limit here to avoid double counting
  try {
    let body: string;
    try {
      const { username, password } = await req.json();
      body = JSON.stringify({ username, password });
    } catch {
      return NextResponse.json(
        { success: false, error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    // Forward only necessary headers: Content-Type + original IP
    const forwardHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const xff = req.headers.get("x-forwarded-for");
    const xri = req.headers.get("x-real-ip");
    if (xff) forwardHeaders["x-forwarded-for"] = xff;
    if (xri) forwardHeaders["x-real-ip"] = xri;

    const internalRes = await fetch(new URL("/api/operator/auth", req.url), {
      method: "POST",
      headers: forwardHeaders,
      body,
    });

    const data = await internalRes.json();
    return NextResponse.json(data, { status: internalRes.status });
  } catch {
    return NextResponse.json(
      { success: false, error: "خطای سرور در احراز هویت" },
      { status: 500 }
    );
  }
}