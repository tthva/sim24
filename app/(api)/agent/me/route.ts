import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-guard";

export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).slice(2, 9);
  const timestamp = new Date().toISOString();
  console.log(`[AGENT_ME_API] Request started (id: ${requestId}, time: ${timestamp})`);
  
  try {
    // Phase 4: Migrated to requireRole with full tokenVersion + session validation
    const auth = await requireRole(request, ["agent", "operator"]);
    if (auth.response) {
      console.log(`[AGENT_ME_API] Auth failed (id: ${requestId})`);
      return auth.response;
    }

    // Find agent via user
    const user = await prisma.user.findUnique({
      where: { id: auth.user.sub },
      include: { agentProfile: { include: { user: { select: { id: true, username: true, fullName: true } } } } },
    });

    if (!user || !user.agentProfile) {
      console.log(`[AGENT_ME_API] User/agent not found (id: ${requestId}, userId: ${auth.user.sub})`);
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    console.log(`[AGENT_ME_API] Success (id: ${requestId}, username: ${user.username})`);
    return NextResponse.json({
      agent: {
        id: user.agentProfile.id,
        username: user.username,
        fullName: user.fullName,
        adminId: user.agentProfile.adminId,
        department: user.agentProfile.department,
      },
    });
  } catch (err) {
    console.error(`[AGENT_ME_API] Error (id: ${requestId}):`, err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}