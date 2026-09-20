-- BaselineLegacyTables
-- Purpose: bring migration history in line with reality for 3 tables that
-- were created in the DB outside of Prisma migrations (schema drift).
-- Applied to the existing DB via 'prisma migrate resolve --applied'
-- (no DDL executed against the live DB). On a FRESH database this migration
-- creates the tables so 'prisma migrate deploy' works end-to-end.
-- These tables have no FK dependencies, so creating them before the
-- initial migration is safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "blacklist_phones" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "addedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "consignment_items" (
    "id" TEXT NOT NULL,
    "simNumber" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "price" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workflowInstanceId" TEXT,
    "duration" INTEGER,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "consignment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "whitelist_phones" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "addedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whitelist_phones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "blacklist_phones_phone_key" ON "blacklist_phones"("phone");
CREATE INDEX IF NOT EXISTS "blacklist_phones_phone_idx" ON "blacklist_phones"("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_items_workflowInstanceId_key" ON "consignment_items"("workflowInstanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "whitelist_phones_phone_key" ON "whitelist_phones"("phone");
CREATE INDEX IF NOT EXISTS "whitelist_phones_phone_idx" ON "whitelist_phones"("phone");
