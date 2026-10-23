-- CreateEnum
CREATE TYPE "public"."JobApplicationStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."certificates" ALTER COLUMN "tier" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."job_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobListingId" TEXT NOT NULL,
    "coverNote" TEXT,
    "resumeStorageKey" TEXT,
    "resumeName" TEXT,
    "status" "public"."JobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_applications_jobListingId_status_idx" ON "public"."job_applications"("jobListingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_userId_jobListingId_key" ON "public"."job_applications"("userId", "jobListingId");

-- AddForeignKey
ALTER TABLE "public"."job_applications" ADD CONSTRAINT "job_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_applications" ADD CONSTRAINT "job_applications_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "public"."job_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_applications" ADD CONSTRAINT "job_applications_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
