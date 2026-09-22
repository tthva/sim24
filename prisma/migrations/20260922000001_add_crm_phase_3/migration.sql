-- CRM Phase 3: Pipeline + Stages + Opportunities + Rejection tracking
-- Applied via `prisma db push`; recorded here for migration history parity.

CREATE TABLE IF NOT EXISTS "crm_pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_pipeline_stages" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_pipeline_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_opportunities" (
    "id" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimatedValue" DECIMAL(15,0),
    "probability" INTEGER,
    "expectedCloseAt" TIMESTAMP(3),
    "assignedToId" UUID,
    "workflowInstanceId" TEXT,
    "customerFormId" TEXT,
    "rejectionReasonId" TEXT,
    "rejectionNotes" TEXT,
    "rejectionFiles" TEXT[],
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_rejection_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_rejection_reasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_task_rejections" (
    "id" TEXT NOT NULL,
    "stepInstanceId" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "notes" TEXT,
    "attachments" TEXT[],
    "rejectedById" UUID NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_task_rejections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipeline_stages_pipelineId_code_key" ON "crm_pipeline_stages"("pipelineId", "code");
CREATE INDEX IF NOT EXISTS "crm_rejection_reasons_code_key" ON "crm_rejection_reasons"("code");
CREATE INDEX IF NOT EXISTS "crm_pipelines_isDefault_idx" ON "crm_pipelines"("isDefault");
CREATE INDEX IF NOT EXISTS "crm_pipelines_department_idx" ON "crm_pipelines"("department");
CREATE INDEX IF NOT EXISTS "crm_pipeline_stages_pipelineId_order_idx" ON "crm_pipeline_stages"("pipelineId", "order");
CREATE INDEX IF NOT EXISTS "crm_opportunities_customerId_idx" ON "crm_opportunities"("customerId");
CREATE INDEX IF NOT EXISTS "crm_opportunities_stageId_idx" ON "crm_opportunities"("stageId");
CREATE INDEX IF NOT EXISTS "crm_opportunities_assignedToId_idx" ON "crm_opportunities"("assignedToId");
CREATE INDEX IF NOT EXISTS "crm_opportunities_pipelineId_stageId_idx" ON "crm_opportunities"("pipelineId", "stageId");
CREATE INDEX IF NOT EXISTS "crm_opportunities_createdAt_idx" ON "crm_opportunities"("createdAt");
CREATE INDEX IF NOT EXISTS "crm_rejection_reasons_isActive_idx" ON "crm_rejection_reasons"("isActive");
CREATE INDEX IF NOT EXISTS "crm_rejection_reasons_category_idx" ON "crm_rejection_reasons"("category");
CREATE INDEX IF NOT EXISTS "crm_task_rejections_stepInstanceId_idx" ON "crm_task_rejections"("stepInstanceId");
CREATE INDEX IF NOT EXISTS "crm_task_rejections_reasonId_idx" ON "crm_task_rejections"("reasonId");
CREATE INDEX IF NOT EXISTS "crm_task_rejections_rejectedAt_idx" ON "crm_task_rejections"("rejectedAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_pipeline_stages_pipelineId_fkey') THEN
    ALTER TABLE "crm_pipeline_stages" ADD CONSTRAINT "crm_pipeline_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_customerId_fkey') THEN
    ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_pipelineId_fkey') THEN
    ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_stageId_fkey') THEN
    ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "crm_pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_assignedToId_fkey') THEN
    ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_opportunities_rejectionReasonId_fkey') THEN
    ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "crm_rejection_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_task_rejections_reasonId_fkey') THEN
    ALTER TABLE "crm_task_rejections" ADD CONSTRAINT "crm_task_rejections_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "crm_rejection_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_task_rejections_rejectedById_fkey') THEN
    ALTER TABLE "crm_task_rejections" ADD CONSTRAINT "crm_task_rejections_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
