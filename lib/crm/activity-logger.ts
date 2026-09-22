import { prisma } from "@/lib/prisma";

/**
 * CRM Phase 2 — non-fatal activity logger.
 * Integrations call this in try/catch contexts; failures must never break
 * the host operation.
 */
export async function logActivity(input: {
  customerId?: string;
  type: string;
  title: string;
  description?: string;
  assignedToId: string;
  priority?: string;
}) {
  try {
    return await prisma.activity.create({
      data: {
        customerId: input.customerId,
        type: input.type,
        title: input.title,
        description: input.description,
        assignedToId: input.assignedToId,
        priority: input.priority ?? "normal",
      },
    });
  } catch (e) {
    console.error("[CRM] logActivity failed (non-fatal):", e);
    return null;
  }
}
