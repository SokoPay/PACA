-- AlterEnum
ALTER TYPE "public"."JobSourceKind" ADD VALUE 'JOBICY';
ALTER TYPE "public"."JobSourceKind" ADD VALUE 'ARBEITNOW';

-- AlterTable
ALTER TABLE "public"."attempts" ADD COLUMN "sharedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."announcements" ADD COLUMN "audience" "public"."CampaignAudience" NOT NULL DEFAULT 'ALL_USERS';

-- AlterTable
ALTER TABLE "public"."job_listings" ADD COLUMN "summary" TEXT;
