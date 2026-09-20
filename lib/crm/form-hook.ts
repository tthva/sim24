// ─────────────────────────────────────────────
// CRM — Form-submission hook (Phase 1)
// One call site per public form route (buy/sell/search/investments).
// BEST-EFFORT ONLY: a CRM failure must NEVER break form submission.
// ─────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { resolveCustomerSafe } from "@/lib/crm/customer-resolver";

export async function hookCrmFormSubmission(input: {
  phone: string | null;
  fullName: string | null;
  formType: string;
  customerFormId: string;
  agentId?: string | null;
}): Promise<void> {
  try {
    if (!input.phone) return;
    const customer = await resolveCustomerSafe({
      phone: input.phone,
      fullName: input.fullName,
      source: input.formType,
      referralAgentId: input.agentId ?? undefined,
    });
    if (!customer) return;
    await prisma.customerInteraction.create({
      data: {
        customerId: customer.id,
        interactionType: "form_submission",
        referenceId: input.customerFormId,
        title: `ثبت فرم ${input.formType}`,
        description: `کد پیگیری: ${input.customerFormId}`,
        metadata: { formType: input.formType },
      },
    });
  } catch (error) {
    // Never propagate — CRM is a side effect of the form flow
    console.error("[CRM] hookCrmFormSubmission failed (non-fatal):", error);
  }
}
