-- CRM Phase 2: Communication + Templates + Activities + Recurring Tasks
-- Applied via `prisma db push` before this file was created; recorded here
-- for migration history parity with Phase 1.

CREATE TABLE IF NOT EXISTS "crm_communications" (
    "id" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "durationSec" INTEGER,
    "recordingUrl" TEXT,
    "externalId" TEXT,
    "templateId" TEXT,
    "operatorId" UUID NOT NULL,
    "relatedTaskId" UUID,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_communications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_message_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "variables" TEXT[],
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_message_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_activities" (
    "id" TEXT NOT NULL,
    "customerId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToId" UUID NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "crm_recurring_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cronExpr" TEXT NOT NULL,
    "assignedToId" UUID NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_recurring_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "crm_communications_customerId_createdAt_idx" ON "crm_communications"("customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_communications_channel_idx" ON "crm_communications"("channel");
CREATE INDEX IF NOT EXISTS "crm_communications_status_idx" ON "crm_communications"("status");
CREATE INDEX IF NOT EXISTS "crm_communications_operatorId_createdAt_idx" ON "crm_communications"("operatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_message_templates_channel_idx" ON "crm_message_templates"("channel");
CREATE INDEX IF NOT EXISTS "crm_message_templates_category_idx" ON "crm_message_templates"("category");
CREATE INDEX IF NOT EXISTS "crm_message_templates_isActive_idx" ON "crm_message_templates"("isActive");
CREATE INDEX IF NOT EXISTS "crm_activities_assignedToId_status_idx" ON "crm_activities"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "crm_activities_dueAt_idx" ON "crm_activities"("dueAt");
CREATE INDEX IF NOT EXISTS "crm_activities_customerId_idx" ON "crm_activities"("customerId");
CREATE INDEX IF NOT EXISTS "crm_recurring_tasks_isActive_nextRunAt_idx" ON "crm_recurring_tasks"("isActive", "nextRunAt");
CREATE INDEX IF NOT EXISTS "crm_recurring_tasks_assignedToId_idx" ON "crm_recurring_tasks"("assignedToId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_communications_customerId_fkey') THEN
    ALTER TABLE "crm_communications" ADD CONSTRAINT "crm_communications_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_communications_operatorId_fkey') THEN
    ALTER TABLE "crm_communications" ADD CONSTRAINT "crm_communications_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_message_templates_createdById_fkey') THEN
    ALTER TABLE "crm_message_templates" ADD CONSTRAINT "crm_message_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_customerId_fkey') THEN
    ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_activities_assignedToId_fkey') THEN
    ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_recurring_tasks_assignedToId_fkey') THEN
    ALTER TABLE "crm_recurring_tasks" ADD CONSTRAINT "crm_recurring_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;