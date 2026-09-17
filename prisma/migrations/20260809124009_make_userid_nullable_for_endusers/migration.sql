-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "userId" DROP NOT NULL;
