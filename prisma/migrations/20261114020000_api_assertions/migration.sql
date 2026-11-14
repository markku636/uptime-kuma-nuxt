-- AlterTable
ALTER TABLE "monitors" ADD COLUMN     "assertions" JSONB,
ADD COLUMN     "auth_config" JSONB;

-- AlterTable
ALTER TABLE "heartbeats" ADD COLUMN     "assertion_results" JSONB,
ADD COLUMN     "check_code" TEXT;

