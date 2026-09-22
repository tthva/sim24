import { prisma } from "@/lib/prisma";

/**
 * CRM Phase 4.3 — customer segment engine.
 *
 * Segment is derived from three REAL signals only:
 *   - Customer.score              (Int 0..100, maintained by lead-scoring.ts)
 *   - a "last touch" timestamp    (lastInteractionAt -> firstInteractionAt -> createdAt)
 *   - lifetime won revenue        (sum of Opportunity.estimatedValue where won)
 *
 * Customer has no `revenue` column, so revenue is derived from Opportunity.
 * Opportunity.estimatedValue is `Decimal? @db.Decimal(15,0)`, so it is converted
 * with `.toNumber()` — max 1e15 stays below Number.MAX_SAFE_INTEGER, no drift.
 */

/**
 * Canonical segment values — deliberately LOWERCASE.
 * The existing CRM UI keys its segment filter dropdown and `CrmBadge` tones off
 * these exact strings (SEGMENT_FA in app/crm/customers/page.tsx,
 * app/crm/customers/[id]/page.tsx and app/crm/page.tsx all use vip/hot/regular/cold).
 * Writing "VIP" would never match the `vip` filter option (value={k}).
 */
export const SEGMENTS = ["vip", "active", "regular", "new", "cold", "lost"] as const;
export type Segment = (typeof SEGMENTS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tunable thresholds — single source of truth for the rules below. */
export const SEGMENT_RULES = {
  newWithinDays: 7,
  vipMinScore: 80,
  vipMinRevenue: 100_000_000, // matches the estimatedValue scale
  activeMinScore: 50,
  activeWithinDays: 30,
  coldAfterDays: 90,
  lostAfterDays: 180,
  lostMaxScore: 10,
  batchSize: 100,
} as const;

export type SegmentSignals = {
  score: number;
  revenue: number;
  createdAt: Date;
  /**
   * Last known touch. Callers pass
   * `lastInteractionAt ?? firstInteractionAt ?? createdAt` — without that final
   * fallback a customer who was never touched would be "immortal regular"
   * instead of eventually going cold/lost.
   */
  lastActivityAt: Date | null;
};

/**
 * Pure decision function (no DB) — exported so it can be unit-tested.
 * Priority order is significant and follows the Phase 4.3 spec:
 *   1. created < 7d                    -> new
 *   2. score >= 80 AND revenue >= 100M -> vip
 *   3. score >= 50 AND idle <= 30d     -> active
 *   4. idle > 180d AND score < 10      -> lost
 *   5. idle > 90d                      -> cold
 *   6. otherwise                       -> regular
 *
 * Note: rule 2 intentionally ignores recency (per spec), so a dormant but
 * high-value customer keeps the vip segment.
 */
export function decideSegment(signals: SegmentSignals, now: Date = new Date()): Segment {
  const r = SEGMENT_RULES;
  const ageDays = (now.getTime() - signals.createdAt.getTime()) / DAY_MS;
  const idleDays =
    signals.lastActivityAt === null
      ? null
      : (now.getTime() - signals.lastActivityAt.getTime()) / DAY_MS;

  if (ageDays < r.newWithinDays) return "new";
  if (signals.score >= r.vipMinScore && signals.revenue >= r.vipMinRevenue) return "vip";
  if (signals.score >= r.activeMinScore && idleDays !== null && idleDays <= r.activeWithinDays) {
    return "active";
  }
  if (idleDays !== null && idleDays > r.lostAfterDays && signals.score < r.lostMaxScore) {
    return "lost";
  }
  if (idleDays !== null && idleDays > r.coldAfterDays) return "cold";
  return "regular";
}

const CUSTOMER_SIGNAL_SELECT = {
  id: true,
  score: true,
  segment: true,
  createdAt: true,
  lastInteractionAt: true,
  firstInteractionAt: true,
} as const;

type CustomerSignalRow = {
  id: string;
  score: number;
  segment: string;
  createdAt: Date;
  lastInteractionAt: Date | null;
  firstInteractionAt: Date | null;
};

function toSignals(row: CustomerSignalRow, revenue: number): SegmentSignals {
  return {
    score: row.score,
    revenue,
    createdAt: row.createdAt,
    lastActivityAt: row.lastInteractionAt ?? row.firstInteractionAt ?? row.createdAt,
  };
}

/**
 * Lifetime won revenue per customer, resolved in ONE query per batch.
 * "Won" = `wonAt` is stamped OR the opportunity sits in an `isWon` stage —
 * some deals reach a won stage without wonAt being stamped, so both are
 * accepted. The OR is on the same row, so nothing is counted twice.
 */
async function wonRevenueByCustomer(customerIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (customerIds.length === 0) return totals;

  const rows = await prisma.opportunity.findMany({
    where: {
      customerId: { in: customerIds },
      OR: [{ wonAt: { not: null } }, { stage: { isWon: true } }],
    },
    select: { customerId: true, estimatedValue: true },
  });

  for (const row of rows) {
    const value = row.estimatedValue === null ? 0 : row.estimatedValue.toNumber();
    totals.set(row.customerId, (totals.get(row.customerId) ?? 0) + value);
  }
  return totals;
}

/**
 * Compute (WITHOUT persisting) one customer's segment.
 * Mirrors lead-scoring.ts: an unknown customer yields the schema default
 * ("regular") rather than throwing.
 */
export async function computeSegment(customerId: string): Promise<string> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: CUSTOMER_SIGNAL_SELECT,
  });
  if (!customer) return "regular";

  const revenue = (await wonRevenueByCustomer([customerId])).get(customerId) ?? 0;
  return decideSegment(toSignals(customer, revenue));
}

/**
 * Compute + persist one customer's segment, but only when it actually changed.
 * Errors are non-fatal (same policy as updateLeadScore in lead-scoring.ts) so a
 * caller inside a request path can never be broken by segmentation.
 */
export async function updateSegment(customerId: string): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: CUSTOMER_SIGNAL_SELECT,
    });
    if (!customer) return;

    const revenue = (await wonRevenueByCustomer([customerId])).get(customerId) ?? 0;
    const next = decideSegment(toSignals(customer, revenue));
    if (next === customer.segment) return;

    await prisma.customer.update({
      where: { id: customerId },
      data: { segment: next },
    });
    console.log(`[CRM segment] ${customerId}: ${customer.segment} -> ${next}`);
  } catch (e) {
    console.error("[CRM] updateSegment failed:", e);
  }
}

/**
 * Recompute every customer in batches of SEGMENT_RULES.batchSize.
 * Returns the number of rows actually changed.
 *
 * Pagination is skip-based over a stable `orderBy: id`; the only column mutated
 * is `segment`, which is not part of the ordering or the filter, so the result
 * set cannot shift under the cursor mid-run.
 */
export async function recomputeAllSegments(): Promise<number> {
  let updated = 0;
  let skip = 0;

  for (;;) {
    const batch = await prisma.customer.findMany({
      take: SEGMENT_RULES.batchSize,
      skip,
      orderBy: { id: "asc" },
      select: CUSTOMER_SIGNAL_SELECT,
    });

    if (batch.length === 0) break;

    const revenueByCustomer = await wonRevenueByCustomer(batch.map((c) => c.id));
    const updates = [];

    for (const row of batch) {
      const next = decideSegment(toSignals(row, revenueByCustomer.get(row.id) ?? 0));
      if (next !== row.segment) {
        updates.push(
          prisma.customer.update({ where: { id: row.id }, data: { segment: next } })
        );
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
      updated += updates.length;
    }

    skip += batch.length;
    if (batch.length < SEGMENT_RULES.batchSize) break;
  }

  return updated;
}

