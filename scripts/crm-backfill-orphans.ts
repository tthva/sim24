/**
 * CRM backfill — link legacy orphan CustomerForm rows to CRM Customers.
 *
 * WHY: 150 of 153 CustomerForm rows were created before the CRM
 * customer-360 feature existed (and/or were never routed through
 * hookCrmFormSubmission), so they have no matching crm_customers row.
 * The Customer 360 timeline resolves a customer's forms through
 * `Customer.primaryPhone = CustomerForm.phone`, so those forms are
 * invisible in the CRM until a Customer exists for their phone.
 *
 * WHAT: for every form whose phone has no Customer, create (or find) the
 * Customer using the EXACT same resolver the form hook uses
 * (resolveCustomerSafe → resolveCustomer), then re-create the
 * `form_submission` CustomerInteraction the hook would have written
 * (with the ORIGINAL form createdAt, so the timeline keeps real history).
 *
 * IDEMPOTENT: the orphan set is defined by "phone has no Customer", so a
 * second run finds nothing to do. The interaction insert is additionally
 * guarded by (customerId, interactionType, referenceId).
 *
 * Idempotency note: for the FIRST form of a given phone the Customer is
 * created via resolveCustomerSafe, which (like the live hook) stamps
 * firstInteractionAt/lastInteractionAt with the run time rather than the
 * original submission date. Subsequent forms for the same phone re-use the
 * Customer and never touch those fields again.
 *
 * Run:
 *   npx tsx scripts/crm-backfill-orphans.ts --dry-run   # read-only pre-flight
 *   npx tsx scripts/crm-backfill-orphans.ts             # apply
 */
import { prisma } from "@/lib/prisma";
import { resolveCustomerSafe } from "@/lib/crm/customer-resolver";

type OrphanForm = {
  id: string;
  phone: string;
  fullName: string | null;
  formType: string;
  agentId: string | null;
  createdAt: Date;
};

const DRY_RUN = process.argv.includes("--dry-run");

async function findOrphanForms(): Promise<OrphanForm[]> {
  return prisma.$queryRaw<OrphanForm[]>`
    SELECT id, phone, "fullName", "formType", "agentId", "createdAt"
    FROM customer_forms cf
    WHERE cf.phone IS NOT NULL
      AND cf.phone <> ''
      AND NOT EXISTS (
        SELECT 1 FROM crm_customers c WHERE c."primaryPhone" = cf.phone
      )
    ORDER BY cf."createdAt" ASC
  `;
}

async function main() {
  const orphanForms = await findOrphanForms();
  const distinctPhones = new Set(orphanForms.map((f) => f.phone));

  console.log(`Found ${orphanForms.length} orphan forms.`);
  console.log(`Distinct phones: ${distinctPhones.size}`);

  // ─── Dry run: pure reads, no writes ───
  if (DRY_RUN) {
    let phonesWithoutCustomer = 0;
    let phonesWithCustomer = 0;
    for (const phone of distinctPhones) {
      const existing = await prisma.customer.findUnique({
        where: { primaryPhone: phone },
        select: { id: true },
      });
      if (existing) phonesWithCustomer++;
      else phonesWithoutCustomer++;
    }

    let interactionsMissing = 0;
    for (const f of orphanForms) {
      const existing = await prisma.customerInteraction.findFirst({
        where: { interactionType: "form_submission", referenceId: f.id },
        select: { id: true },
      });
      if (!existing) interactionsMissing++;
    }

    console.log("\nDRY RUN — no writes performed.");
    console.log(`  phones that would CREATE a customer : ${phonesWithoutCustomer}`);
    console.log(`  phones that would FIND a customer   : ${phonesWithCustomer}`);
    console.log(`  interactions that would be INSERTED : ${interactionsMissing}`);
    return;
  }

  // ─── Apply ───
  let created = 0;
  let found = 0;
  let interactionsCreated = 0;
  let interactionsSkipped = 0;
  let errors = 0;

  for (const form of orphanForms) {
    try {
      let customer = await prisma.customer.findUnique({
        where: { primaryPhone: form.phone },
      });
      let action: "created" | "found";

      if (customer) {
        action = "found";
        found++;
      } else {
        const resolved = await resolveCustomerSafe({
          phone: form.phone,
          fullName: form.fullName,
          source: form.formType,
          referralAgentId: form.agentId,
        });
        if (!resolved) {
          errors++;
          console.error(`✗ resolver returned null for form ${form.id} / phone ${form.phone}`);
          continue;
        }
        customer = resolved;
        action = "created";
        created++;
      }

      const existingInteraction = await prisma.customerInteraction.findFirst({
        where: {
          customerId: customer.id,
          interactionType: "form_submission",
          referenceId: form.id,
        },
        select: { id: true },
      });

      if (existingInteraction) {
        interactionsSkipped++;
        console.log(`= form ${form.id} -> customer ${customer.customerCode} (interaction already exists)`);
        continue;
      }

      await prisma.customerInteraction.create({
        data: {
          customerId: customer.id,
          interactionType: "form_submission",
          referenceId: form.id,
          title: `ثبت فرم ${form.formType}`,
          description: `کد پیگیری: ${form.id}`,
          metadata: { formType: form.formType, backfilled: true },
          createdAt: form.createdAt,
        },
      });
      interactionsCreated++;
      console.log(
        `✓ form ${form.id} (${form.phone}) -> customer ${customer.customerCode} (${action}) + interaction`
      );
    } catch (err) {
      errors++;
      console.error(`✗ Error for form ${form.id} / phone ${form.phone}:`, err);
    }
  }

  console.log("\nResults:");
  console.log(`  Customers created:    ${created}`);
  console.log(`  Customers found:      ${found}`);
  console.log(`  Interactions created: ${interactionsCreated}`);
  console.log(`  Interactions skipped: ${interactionsSkipped}`);
  console.log(`  Errors:               ${errors}`);

  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
