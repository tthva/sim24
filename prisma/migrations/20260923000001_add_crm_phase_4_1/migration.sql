-- CRM Phase 4.1: Automation rules + execution logs + daily metric snapshots
-- Delta generated with `prisma migrate diff` (phase-3 datamodel -> phase-4.1 datamodel).
-- Applied via `prisma db push`; recorded here for migration history parity.

CREATE TABLE IF NOT EXISTS "automation_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "trigger" TEXT NOT NULL,
    "triggerConfig" JSONB,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "automation_logs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "context" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "daily_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customersNew" INTEGER NOT NULL DEFAULT 0,
    "customersActive" INTEGER NOT NULL DEFAULT 0,
    "formsSubmitted" INTEGER NOT NULL DEFAULT 0,
    "formsByType" JSONB,
    "tasksAssigned" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "tasksRejected" INTEGER NOT NULL DEFAULT 0,
    "avgTaskDurationMin" INTEGER,
    "dealsCreated" INTEGER NOT NULL DEFAULT 0,
    "dealsWon" INTEGER NOT NULL DEFAULT 0,
    "dealsLost" INTEGER NOT NULL DEFAULT 0,
    "dealValue" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "smsReceived" INTEGER NOT NULL DEFAULT 0,
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "automation_rules_isActive_priority_idx" ON "automation_rules"("isActive", "priority");
CREATE INDEX IF NOT EXISTS "automation_rules_trigger_idx" ON "automation_rules"("trigger");
CREATE INDEX IF NOT EXISTS "automation_logs_ruleId_createdAt_idx" ON "automation_logs"("ruleId", "createdAt");
CREATE INDEX IF NOT EXISTS "automation_logs_success_idx" ON "automation_logs"("success");
CREATE INDEX IF NOT EXISTS "automation_logs_entityType_entityId_idx" ON "automation_logs"("entityType", "entityId");
CREATE UNIQUE INDEX IF NOT EXISTS "daily_metrics_date_key" ON "daily_metrics"("date");
CREATE INDEX IF NOT EXISTS "daily_metrics_date_idx" ON "daily_metrics"("date");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_rules_createdById_fkey') THEN
    ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'automation_logs_ruleId_fkey') THEN
    ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
