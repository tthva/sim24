import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  // Phase 4: Use requireAuth which checks tokenVersion + session status
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const user = auth.user;
  return NextResponse.json({
    authenticated: true,
    role: user.role,
    id: user.sub,
    sessionId: user.sessionId,
  });
}
