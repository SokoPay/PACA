-- CreateEnum
CREATE TYPE "public"."AutoReviewVerdict" AS ENUM ('APPROVE', 'FLAG', 'REJECT');

-- AlterTable
ALTER TABLE "public"."questions" ADD COLUMN     "autoReviewConfidence" DECIMAL(4,3),
ADD COLUMN     "autoReviewIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "autoReviewNotes" TEXT,
ADD COLUMN     "autoReviewProvider" TEXT,
ADD COLUMN     "autoReviewVerdict" "public"."AutoReviewVerdict",
ADD COLUMN     "autoReviewedAt" TIMESTAMP(3),
ADD COLUMN     "independentAnswerAgreed" BOOLEAN,
ADD COLUMN     "reviewPriority" INTEGER;

-- CreateIndex
CREATE INDEX "questions_status_reviewPriority_idx" ON "public"."questions"("status", "reviewPriority");
