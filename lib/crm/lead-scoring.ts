import { prisma } from "@/lib/prisma";

/**
 * CRM Phase 3 — Lead scoring engine.
 * Auto-computes 0..100 from interactions, communications, deals and recency.
 * Persists to the existing Customer.score column (Phase 1 field).
 */
export async function computeLeadScore(customerId: string): Promise<number> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      interactions: true,
      communications: true,
      opportunities: true,
    },
  });
  if (!customer) return 0;

  let score = 0;

  // Interactions
  score += customer.interactions.length * 10;

  // Communications
  const smsOut = customer.communications.filter(
    (c) => c.channel === "sms" && c.direction === "outbound"
  ).length;
  const smsIn = customer.communications.filter(
    (c) => c.channel === "sms" && c.direction === "inbound"
  ).length;
  const calls = customer.communications.filter((c) => c.channel === "call").length;
  score += smsOut * 5;
  score += smsIn * 15;
  score += calls * 8;

  // Deals
  const wonDeals = customer.opportunities.filter((o) => o.wonAt).length;
  const lostDeals = customer.opportunities.filter((o) => o.lostAt).length;
  score += wonDeals * 50;
  score -= lostDeals * 20;

  // Recency bonus
  const lastInteraction = customer.interactions
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (lastInteraction) {
    const daysSince =
      (Date.now() - lastInteraction.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) score += 10;
    else if (daysSince < 30) score += 5;
    else if (daysSince > 90) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

export async function updateLeadScore(customerId: string): Promise<void> {
  try {
    const score = await computeLeadScore(customerId);
    await prisma.customer.update({
      where: { id: customerId },
      data: { score },
    });
  } catch (e) {
    console.error("[CRM] updateLeadScore failed:", e);
  }
}
