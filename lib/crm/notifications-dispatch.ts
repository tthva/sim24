import { prisma } from "@/lib/prisma";

/**
 * CRM Phase 4.2 — notification dispatch helper.
 *
 * `Notification.agentId` is a FK to `Agent.id`, but automation rules and
 * trigger events carry `User.id`. This helper resolves User.id -> Agent.id so
 * callers never need to know about the Agent layer.
 *
 * Never throws — always returns a result object (same convention as
 * lib/crm/sms-sender.ts).
 */
export async function sendNotification(input: {
  userId: string;
  title: string;
  body: string;
  link?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Notification.agentId is FK to Agent.id; we receive User.id.
    const agent = await prisma.agent.findUnique({
      where: { userId: input.userId },
      select: { id: true },
    });
    if (!agent) {
      return { success: false, error: "target user has no Agent profile" };
    }
    await prisma.notification.create({
      data: {
        agentId: agent.id,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "unknown error" };
  }
}
