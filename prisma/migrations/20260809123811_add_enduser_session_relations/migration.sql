-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "endUserId" UUID;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "endUserId" UUID;

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_endUserId_idx" ON "refresh_tokens"("endUserId");

-- CreateIndex
CREATE INDEX "sessions_endUserId_idx" ON "sessions"("endUserId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "end_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "end_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
