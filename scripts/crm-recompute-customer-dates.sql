-- Phase 4.8c hardening — decision D2
-- Recompute Customer.firstInteractionAt / lastInteractionAt from REAL activity.
--
-- Why: the legacy-form backfill (scripts/crm-backfill-orphans.ts) created
-- Customer rows without touching these timestamps, so they all carried the
-- backfill wall-clock time (2026-09-27 04:38 UTC) instead of the moment the
-- customer actually first appeared. The interactions themselves DO carry the
-- historical form timestamps, so they are the correct source.
--
-- Idempotent: recomputes from scratch, so re-running is always safe.
-- Scoped: only touches rows that have at least one real interaction; empty
-- customers keep whatever timestamp they already had.
--
-- PostgreSQL note: GREATEST/LEAST ignore NULL arguments and only return NULL
-- when every argument is NULL, so empty crm_communications / crm_activities
-- are handled without COALESCE.
--
-- Run:
--   docker exec -i sim24-db psql -U sim24 -d sim24 < scripts/crm-recompute-customer-dates.sql

BEGIN;

UPDATE crm_customers c
SET
  "firstInteractionAt" = LEAST(
    (SELECT MIN("createdAt") FROM crm_customer_interactions WHERE "customerId" = c.id),
    (SELECT MIN("createdAt") FROM crm_communications        WHERE "customerId" = c.id),
    (SELECT MIN("createdAt") FROM crm_activities            WHERE "customerId" = c.id)
  ),
  "lastInteractionAt" = GREATEST(
    (SELECT MAX("createdAt") FROM crm_customer_interactions WHERE "customerId" = c.id),
    (SELECT MAX("createdAt") FROM crm_communications        WHERE "customerId" = c.id),
    (SELECT MAX("createdAt") FROM crm_activities            WHERE "customerId" = c.id)
  )
WHERE EXISTS (
  SELECT 1 FROM crm_customer_interactions WHERE "customerId" = c.id
);

-- Sanity guard: every customer that HAS interactions must end up with a
-- non-NULL first/last. Empty customers are intentionally left alone.
DO $$
DECLARE bad integer;
BEGIN
  SELECT COUNT(*) INTO bad
  FROM crm_customers c
  WHERE EXISTS (SELECT 1 FROM crm_customer_interactions WHERE "customerId" = c.id)
    AND (c."firstInteractionAt" IS NULL OR c."lastInteractionAt" IS NULL);
  IF bad > 0 THEN
    RAISE EXCEPTION 'D2 abort: % customer rows still have NULL interaction timestamps', bad;
  END IF;
END $$;

COMMIT;
