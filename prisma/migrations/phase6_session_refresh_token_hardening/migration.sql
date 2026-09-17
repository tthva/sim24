-- Phase 6: Session/RefreshToken Hardening
-- Safe forward-only migration.

-- 1. Make refresh_tokens.tokenHash unique
DROP INDEX IF EXISTS "refresh_tokens_tokenHash_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- 2. Change refresh_tokens.sessionId FK from RESTRICT to CASCADE
ALTER TABLE IF EXISTS "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_sessionId_fkey";
ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;