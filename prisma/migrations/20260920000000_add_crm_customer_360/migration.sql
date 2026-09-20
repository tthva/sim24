-- AddCrmCustomer360
-- CRM Phase 1 tables. Applied to the existing DB via 'prisma db push'
-- (because 'migrate dev' demanded a full DB RESET due to pre-existing drift);
-- this file holds the DDL so 'prisma migrate deploy' works on a fresh DB.
-- FKs reference users/agents, both created by earlier migrations.

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_customers" (
    "id" UUID NOT NULL,
    "customerCode" TEXT NOT NULL,
    "fullName" TEXT,
    "primaryPhone" TEXT NOT NULL,
    "secondaryPhone" TEXT,
    "nationalId" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'regular',
    "status" TEXT NOT NULL DEFAULT 'active',
    "score" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "referralAgentId" UUID,
    "firstInteractionAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_customer_interactions" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "interactionType" TEXT NOT NULL,
    "referenceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_customer_notes" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" UUID,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_customer_tags" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_customer_documents" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "title" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_customers_customerCode_key" ON "crm_customers"("customerCode");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_customers_primaryPhone_key" ON "crm_customers"("primaryPhone");
CREATE INDEX IF NOT EXISTS "crm_customers_customerCode_idx" ON "crm_customers"("customerCode");
CREATE INDEX IF NOT EXISTS "crm_customers_primaryPhone_idx" ON "crm_customers"("primaryPhone");
CREATE INDEX IF NOT EXISTS "crm_customers_segment_idx" ON "crm_customers"("segment");
CREATE INDEX IF NOT EXISTS "crm_customers_status_idx" ON "crm_customers"("status");
CREATE INDEX IF NOT EXISTS "crm_customers_score_idx" ON "crm_customers"("score");
CREATE INDEX IF NOT EXISTS "crm_customers_lastInteractionAt_idx" ON "crm_customers"("lastInteractionAt");
CREATE INDEX IF NOT EXISTS "crm_customers_createdAt_idx" ON "crm_customers"("createdAt");
CREATE INDEX IF NOT EXISTS "crm_customer_interactions_customerId_createdAt_idx" ON "crm_customer_interactions"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_customer_interactions_interactionType_idx" ON "crm_customer_interactions"("interactionType");
CREATE INDEX IF NOT EXISTS "crm_customer_interactions_referenceId_idx" ON "crm_customer_interactions"("referenceId");
CREATE INDEX IF NOT EXISTS "crm_customer_notes_customerId_createdAt_idx" ON "crm_customer_notes"("customerId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_customer_tags_customerId_tag_key" ON "crm_customer_tags"("customerId", "tag");
CREATE INDEX IF NOT EXISTS "crm_customer_tags_tag_idx" ON "crm_customer_tags"("tag");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_customer_documents_fileKey_key" ON "crm_customer_documents"("fileKey");
CREATE INDEX IF NOT EXISTS "crm_customer_documents_customerId_createdAt_idx" ON "crm_customer_documents"("customerId", "createdAt");

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customers" ADD CONSTRAINT "crm_customers_referralAgentId_fkey" FOREIGN KEY ("referralAgentId") REFERENCES "agents"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customer_interactions" ADD CONSTRAINT "crm_customer_interactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customer_notes" ADD CONSTRAINT "crm_customer_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customer_documents" ADD CONSTRAINT "crm_customer_documents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "crm_customer_documents" ADD CONSTRAINT "crm_customer_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;


