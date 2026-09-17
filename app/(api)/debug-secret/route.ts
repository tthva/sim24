// ============================
// SIM24 — Debug Secret Endpoint (DISABLED IN PRODUCTION)
// ============================
// This endpoint is intentionally disabled for security.
// It was leaking JWT_SECRET existence/length information.
// ============================

import { NextResponse } from "next/server";

export async function GET() {
  // Security: Always return 404 to prevent information disclosure
  return NextResponse.json(
    { error: "Not found" },
    { status: 404 }
  );
}