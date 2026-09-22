/**
 * CRM Phase 4.3 — recompute every customer's segment (CLI wrapper).
 *
 * Usage:
 *   npx tsx scripts/crm-recompute-segments.ts
 *
 * Only rows whose segment actually changes are written.
 */
import { recomputeAllSegments } from "@/lib/crm/segment-engine";
import { prisma } from "@/lib/prisma";

recomputeAllSegments()
  .then((n) => console.log(`✅ Updated ${n} customers`))
  .catch((e) => {
    console.error("❌ recompute-segments failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
