-- DropIndex
DROP INDEX "refresh_tokens_sessionId_idx";

-- CreateIndex
CREATE INDEX "customer_forms_formType_workflowStarted_createdAt_idx" ON "customer_forms"("formType", "workflowStarted", "createdAt");

-- CreateIndex
CREATE INDEX "customer_forms_phone_formType_createdAt_idx" ON "customer_forms"("phone", "formType", "createdAt");

-- CreateIndex
CREATE INDEX "customer_forms_fullName_formType_idx" ON "customer_forms"("fullName", "formType");
