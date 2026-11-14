-- AlterTable
ALTER TABLE "public"."one_time_tokens" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."resources" ADD COLUMN "tiers" "public"."MembershipTier"[] DEFAULT ARRAY[]::"public"."MembershipTier"[],
ADD COLUMN "fileName" TEXT,
ADD COLUMN "fileSizeBytes" INTEGER;
