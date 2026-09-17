import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie, isSecureRequest } from "@/lib/auth-guard";

// Reserved for future Agent (نماینده) auth.
// Operators/Admin login is now handled by /api/operator/auth.

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { success: false, error: "Not implemented: /api/agent/auth is reserved for Agents" },
    { status: 501 }
  );
}

export async function DELETE(request: NextRequest) {
  const secure = isSecureRequest(request);
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response, secure);
  return response;
}