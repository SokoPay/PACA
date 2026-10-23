-- CreateEnum
CREATE TYPE "public"."LegalDocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_AND_CONDITIONS', 'DATA_PROTECTION_POLICY', 'DATA_USAGE_POLICY', 'COOKIE_POLICY', 'CODE_OF_CONDUCT');

-- CreateEnum
CREATE TYPE "public"."DataRequestType" AS ENUM ('EXPORT', 'ERASURE', 'RECTIFICATION', 'RESTRICTION');

-- CreateEnum
CREATE TYPE "public"."DataRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "marketingOptInAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."legal_documents" (
    "id" TEXT NOT NULL,
    "type" "public"."LegalDocumentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_subject_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."DataRequestType" NOT NULL,
    "status" "public"."DataRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueBy" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "handledByUserId" TEXT,
    "notes" TEXT,
    "exportStorageKey" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legal_documents_type_isCurrent_idx" ON "public"."legal_documents"("type", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_type_version_key" ON "public"."legal_documents"("type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_slug_version_key" ON "public"."legal_documents"("slug", "version");

-- CreateIndex
CREATE INDEX "user_consents_userId_idx" ON "public"."user_consents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_userId_documentId_key" ON "public"."user_consents"("userId", "documentId");

-- CreateIndex
CREATE INDEX "data_subject_requests_status_dueBy_idx" ON "public"."data_subject_requests"("status", "dueBy");

-- CreateIndex
CREATE INDEX "data_subject_requests_userId_idx" ON "public"."data_subject_requests"("userId");

-- AddForeignKey
ALTER TABLE "public"."user_consents" ADD CONSTRAINT "user_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_consents" ADD CONSTRAINT "user_consents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_subject_requests" ADD CONSTRAINT "data_subject_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
