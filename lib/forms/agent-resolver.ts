import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the agent ID from the authenticated user's JWT token.
 * 
 * SECURITY: This function NO LONGER trusts query-string agentId.
 * The only source of truth for agent identity is the JWT token.
 * 
 * For unauthenticated public form submissions, agentId is null.
 * Referral tracking should use a separate mechanism (e.g., signed referral links).
 */
export async function resolveAgentId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("token")?.value;
  if (!token) {
    // Unauthenticated users: no agentId is trusted
    return null;
  }

  try {
    const payload = await verifyToken(token);
    
    // Only "agent" role users can be associated as agents
    if (payload.role !== "agent") {
      return null;
    }

    // payload.sub is User.id (UUID); CustomerForm.agentId must be Agent.id
    const agent = await prisma.agent.findFirst({
      where: { userId: payload.sub },
      select: { id: true },
    });

    return agent?.id ?? null;
  } catch {
    // Invalid token — no agentId
    return null;
  }
}
