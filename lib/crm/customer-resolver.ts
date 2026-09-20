// ─────────────────────────────────────────────
// CRM — Customer resolver (auto-dedup by phone)
// Given a phone number (+ optional name), find or create a Customer.
// Every form submission funnels through here so each customer has
// exactly ONE record regardless of how many forms they submit.
// ─────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { generateCustomerCode } from "@/lib/crm/customer-code";
import type { Customer } from "@prisma/client";

/**
 * Normalize a phone number: strip non-digits, convert Persian digits,
 * keep the last 11 digits (standard Iranian mobile format 09xxxxxxxxx).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const persianToEnglish = (s: string) =>
    s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
  const digits = persianToEnglish(raw).replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-11);
}

export type ResolveCustomerInput = {
  phone: string;
  fullName?: string | null;
  source?: string | null;
  referralAgentId?: string | null;
};

/**
 * Find or create a Customer by normalized phone.
 * - Found  → bump score/lastInteractionAt, update missing name
 * - Missed → create with a sequential customerCode
 */
export async function resolveCustomer(
  input: ResolveCustomerInput
): Promise<Customer> {
  const phone = normalizePhone(input.phone);
  if (!phone || phone.length !== 11) {
    throw new Error(`Invalid phone for customer resolution: "${input.phone}"`);
  }

  const existing = await prisma.customer.findUnique({
    where: { primaryPhone: phone },
  });

  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: {
        lastInteractionAt: new Date(),
        score: Math.min(existing.score + 5, 100),
        // Backfill name if we only had a phone before
        fullName: existing.fullName || input.fullName || null,
      },
    });
  }

  const customerCode = await generateCustomerCode();
  return prisma.customer.create({
    data: {
      customerCode,
      primaryPhone: phone,
      fullName: input.fullName || null,
      source: input.source || null,
      referralAgentId: input.referralAgentId || null,
      segment: "regular",
      status: "active",
      score: 10, // baseline for a first-touch customer
      firstInteractionAt: new Date(),
      lastInteractionAt: new Date(),
    },
  });
}

/**
 * Best-effort CRM hook for form routes: never throws.
 * Used AFTER a successful CustomerForm.create so a CRM failure
 * can never break the public form submission flow.
 */
export async function resolveCustomerSafe(
  input: ResolveCustomerInput
): Promise<Customer | null> {
  try {
    return await resolveCustomer(input);
  } catch (error) {
    console.error("[CRM] resolveCustomer failed (non-fatal):", error);
    return null;
  }
}
