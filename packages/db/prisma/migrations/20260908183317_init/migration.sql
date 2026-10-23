-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('MEMBER', 'REVIEWER', 'ADMIN', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."TokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "public"."MembershipTier" AS ENUM ('STUDENT', 'PROFESSIONAL', 'EXECUTIVE', 'FELLOW', 'RETIRED');

-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "public"."DocumentKind" AS ENUM ('STUDENT_ID', 'RECOMMENDATION_LETTER', 'PROFESSIONAL_CERTIFICATE', 'CV', 'PROOF_OF_RETIREMENT', 'PUBLICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."MembershipStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'LAPSED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('PAYSTACK', 'STRIPE', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."PaymentPurpose" AS ENUM ('MEMBERSHIP_SUBSCRIPTION', 'MEMBERSHIP_RENEWAL', 'EXAM_RESIT', 'COURSE_PURCHASE');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('INITIALIZED', 'PENDING', 'SUCCESS', 'FAILED', 'ABANDONED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."Difficulty" AS ENUM ('FOUNDATION', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "public"."QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'REJECTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "public"."QuestionOrigin" AS ENUM ('HUMAN', 'AI_GENERATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "public"."QuestionKind" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE');

-- CreateEnum
CREATE TYPE "public"."ReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "public"."AssessmentType" AS ENUM ('FREE_OPEN', 'CERTIFICATION');

-- CreateEnum
CREATE TYPE "public"."EntitlementSource" AS ENUM ('SUBSCRIPTION', 'RESIT_PURCHASE', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "public"."AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED', 'VOIDED');

-- CreateEnum
CREATE TYPE "public"."CertificateStatus" AS ENUM ('VALID', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."CourseProvider" AS ENUM ('PACA', 'PARTNER');

-- CreateEnum
CREATE TYPE "public"."PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."EnrollmentSource" AS ENUM ('FREE', 'PURCHASED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "public"."DiscountScope" AS ENUM ('MEMBERSHIP', 'COURSE', 'EVENT', 'PARTNER_COURSE');

-- CreateEnum
CREATE TYPE "public"."NotificationKind" AS ENUM ('SYSTEM', 'MEMBERSHIP', 'PAYMENT', 'ASSESSMENT', 'CERTIFICATE', 'COURSE', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "public"."CampaignAudience" AS ENUM ('ALL_MEMBERS', 'BY_TIER', 'SPECIFIC_USERS', 'ALL_USERS');

-- CreateEnum
CREATE TYPE "public"."ResourceKind" AS ENUM ('ARTICLE', 'PDF', 'VIDEO', 'LINK', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "public"."JobSourceKind" AS ENUM ('GREENHOUSE', 'LEVER', 'WORKABLE', 'ASHBY', 'RSS', 'ADZUNA', 'PARTNER_SUBMITTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."AgileRole" AS ENUM ('SCRUM_MASTER', 'PRODUCT_OWNER', 'PRODUCT_MANAGER', 'AGILE_COACH', 'RELEASE_TRAIN_ENGINEER', 'DELIVERY_MANAGER', 'BUSINESS_ANALYST', 'AGILE_TRAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."Seniority" AS ENUM ('ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarKey" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."one_time_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "public"."TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gender" "public"."Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateProvince" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "highestQualification" TEXT,
    "yearOfGraduation" INTEGER,
    "occupation" TEXT,
    "employer" TEXT,
    "institution" TEXT,
    "institutionLevel" TEXT,
    "programOfStudy" TEXT,
    "linkedinUrl" TEXT,
    "bio" TEXT,
    "isPublicInDirectory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tier_configs" (
    "tier" "public"."MembershipTier" NOT NULL,
    "displayName" TEXT NOT NULL,
    "priceUsdCents" INTEGER NOT NULL,
    "designation" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "examQuestionCount" INTEGER NOT NULL DEFAULT 60,
    "examDurationMins" INTEGER NOT NULL DEFAULT 60,
    "passMarkBps" INTEGER NOT NULL DEFAULT 8500,
    "difficulty" "public"."Difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "attemptsPerEntitlement" INTEGER NOT NULL DEFAULT 3,
    "resitPriceUsdCents" INTEGER NOT NULL DEFAULT 0,
    "resitAttemptsGranted" INTEGER NOT NULL DEFAULT 3,
    "requiresExam" BOOLEAN NOT NULL DEFAULT true,
    "requiresPanel" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tier_configs_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "public"."membership_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "public"."MembershipTier" NOT NULL,
    "status" "public"."ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."application_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" "public"."DocumentKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "scanStatus" "public"."ScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "tier" "public"."MembershipTier" NOT NULL,
    "status" "public"."MembershipStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "lapsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."membership_periods" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "tier" "public"."MembershipTier" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountUsdCents" INTEGER NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL DEFAULT 'PAYSTACK',
    "providerRef" TEXT NOT NULL,
    "purpose" "public"."PaymentPurpose" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'INITIALIZED',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "amountUsdCents" INTEGER NOT NULL,
    "fxRate" DECIMAL(18,8),
    "channel" TEXT,
    "discountCodeId" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."topics" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."questions" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "kind" "public"."QuestionKind" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "difficulty" "public"."Difficulty" NOT NULL,
    "stem" TEXT NOT NULL,
    "explanation" TEXT,
    "sourceRef" TEXT,
    "status" "public"."QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "origin" "public"."QuestionOrigin" NOT NULL DEFAULT 'HUMAN',
    "aiModel" TEXT,
    "aiPrompt" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "timesServed" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."question_reviews" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "public"."ReviewDecision" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."exam_entitlements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "public"."MembershipTier" NOT NULL,
    "source" "public"."EntitlementSource" NOT NULL,
    "attemptsGranted" INTEGER NOT NULL DEFAULT 3,
    "attemptsUsed" INTEGER NOT NULL DEFAULT 0,
    "paymentId" TEXT,
    "grantedByUserId" TEXT,
    "grantReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."AssessmentType" NOT NULL,
    "tier" "public"."MembershipTier",
    "entitlementId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "public"."AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "questionCount" INTEGER NOT NULL,
    "passMarkBps" INTEGER NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "difficulty" "public"."Difficulty" NOT NULL,
    "seed" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "scoreBps" INTEGER,
    "correctCount" INTEGER,
    "passed" BOOLEAN,
    "certificateIssued" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attempt_questions" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "optionOrder" TEXT[],
    "selectedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."question_exposures" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "servedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_exposures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."certificates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "attemptId" TEXT,
    "tier" "public"."MembershipTier" NOT NULL,
    "holderName" TEXT NOT NULL,
    "designation" TEXT,
    "scoreBps" INTEGER,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "public"."CertificateStatus" NOT NULL DEFAULT 'VALID',
    "pdfStorageKey" TEXT,
    "badgeStorageKey" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."partners" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoKey" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "provider" "public"."CourseProvider" NOT NULL DEFAULT 'PACA',
    "partnerId" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "priceUsdCents" INTEGER NOT NULL DEFAULT 0,
    "coverImageKey" TEXT,
    "externalUrl" TEXT,
    "durationMins" INTEGER,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "showOnPublicSite" BOOLEAN NOT NULL DEFAULT true,
    "visibleToTiers" "public"."MembershipTier"[] DEFAULT ARRAY[]::"public"."MembershipTier"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" "public"."EnrollmentSource" NOT NULL DEFAULT 'FREE',
    "paymentId" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "scope" "public"."DiscountScope" NOT NULL,
    "percentOff" INTEGER,
    "amountOffUsdCents" INTEGER,
    "courseId" TEXT,
    "partnerId" TEXT,
    "eligibleTiers" "public"."MembershipTier"[] DEFAULT ARRAY[]::"public"."MembershipTier"[],
    "eligibleUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "maxPerUser" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discount_redemptions" (
    "id" TEXT NOT NULL,
    "discountCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "public"."NotificationKind" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_campaigns" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" "public"."CampaignAudience" NOT NULL,
    "tiers" "public"."MembershipTier"[] DEFAULT ARRAY[]::"public"."MembershipTier"[],
    "userIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sendInApp" BOOLEAN NOT NULL DEFAULT true,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "pinnedUntil" TIMESTAMP(3),
    "visibleToTiers" "public"."MembershipTier"[] DEFAULT ARRAY[]::"public"."MembershipTier"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" "public"."MembershipTier",
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."ResourceKind" NOT NULL,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "topicId" TEXT,
    "minTier" "public"."MembershipTier",
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."JobSourceKind" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_listings" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyLogoUrl" TEXT,
    "location" TEXT,
    "country" TEXT,
    "isRemote" BOOLEAN NOT NULL DEFAULT false,
    "employmentType" TEXT,
    "description" TEXT,
    "applyUrl" TEXT NOT NULL,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT,
    "agileRole" "public"."AgileRole",
    "seniority" "public"."Seniority",
    "aiConfidence" DECIMAL(4,3),
    "aiClassifiedAt" TIMESTAMP(3),
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "postedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobListingId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_status_role_idx" ON "public"."users"("status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "public"."refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_family_idx" ON "public"."refresh_tokens"("userId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_tokenHash_key" ON "public"."one_time_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "one_time_tokens_userId_purpose_idx" ON "public"."one_time_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "public"."audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "public"."audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "public"."profiles"("userId");

-- CreateIndex
CREATE INDEX "profiles_country_isPublicInDirectory_idx" ON "public"."profiles"("country", "isPublicInDirectory");

-- CreateIndex
CREATE INDEX "membership_applications_status_tier_idx" ON "public"."membership_applications"("status", "tier");

-- CreateIndex
CREATE INDEX "membership_applications_userId_idx" ON "public"."membership_applications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_storageKey_key" ON "public"."application_documents"("storageKey");

-- CreateIndex
CREATE INDEX "application_documents_applicationId_idx" ON "public"."application_documents"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_key" ON "public"."memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_memberNumber_key" ON "public"."memberships"("memberNumber");

-- CreateIndex
CREATE INDEX "memberships_status_tier_idx" ON "public"."memberships"("status", "tier");

-- CreateIndex
CREATE INDEX "memberships_currentPeriodEnd_idx" ON "public"."memberships"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "membership_periods_paymentId_key" ON "public"."membership_periods"("paymentId");

-- CreateIndex
CREATE INDEX "membership_periods_membershipId_periodStart_idx" ON "public"."membership_periods"("membershipId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "payments_providerRef_key" ON "public"."payments"("providerRef");

-- CreateIndex
CREATE INDEX "payments_userId_status_idx" ON "public"."payments"("userId", "status");

-- CreateIndex
CREATE INDEX "payments_purpose_status_idx" ON "public"."payments"("purpose", "status");

-- CreateIndex
CREATE INDEX "webhook_events_processedAt_idx" ON "public"."webhook_events"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_providerEventId_key" ON "public"."webhook_events"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "public"."topics"("slug");

-- CreateIndex
CREATE INDEX "questions_status_difficulty_topicId_idx" ON "public"."questions"("status", "difficulty", "topicId");

-- CreateIndex
CREATE INDEX "question_options_questionId_idx" ON "public"."question_options"("questionId");

-- CreateIndex
CREATE INDEX "question_reviews_questionId_idx" ON "public"."question_reviews"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_entitlements_paymentId_key" ON "public"."exam_entitlements"("paymentId");

-- CreateIndex
CREATE INDEX "exam_entitlements_userId_tier_idx" ON "public"."exam_entitlements"("userId", "tier");

-- CreateIndex
CREATE INDEX "attempts_userId_type_status_idx" ON "public"."attempts"("userId", "type", "status");

-- CreateIndex
CREATE INDEX "attempts_status_expiresAt_idx" ON "public"."attempts"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptId_questionId_key" ON "public"."attempt_questions"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptId_position_key" ON "public"."attempt_questions"("attemptId", "position");

-- CreateIndex
CREATE INDEX "question_exposures_userId_servedOn_idx" ON "public"."question_exposures"("userId", "servedOn");

-- CreateIndex
CREATE UNIQUE INDEX "question_exposures_userId_questionId_servedOn_key" ON "public"."question_exposures"("userId", "questionId", "servedOn");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_credentialId_key" ON "public"."certificates"("credentialId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_attemptId_key" ON "public"."certificates"("attemptId");

-- CreateIndex
CREATE INDEX "certificates_userId_idx" ON "public"."certificates"("userId");

-- CreateIndex
CREATE INDEX "certificates_status_idx" ON "public"."certificates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "public"."partners"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "public"."courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_provider_idx" ON "public"."courses"("status", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_paymentId_key" ON "public"."enrollments"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_userId_courseId_key" ON "public"."enrollments"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "public"."discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_codes_isActive_validUntil_idx" ON "public"."discount_codes"("isActive", "validUntil");

-- CreateIndex
CREATE INDEX "discount_redemptions_discountCodeId_userId_idx" ON "public"."discount_redemptions"("discountCodeId", "userId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "public"."notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "announcements_slug_key" ON "public"."announcements"("slug");

-- CreateIndex
CREATE INDEX "announcements_status_publishedAt_idx" ON "public"."announcements"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "public"."invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_acceptedByUserId_key" ON "public"."invitations"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "public"."invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "resources_slug_key" ON "public"."resources"("slug");

-- CreateIndex
CREATE INDEX "resources_status_kind_idx" ON "public"."resources"("status", "kind");

-- CreateIndex
CREATE INDEX "job_listings_status_agileRole_country_idx" ON "public"."job_listings"("status", "agileRole", "country");

-- CreateIndex
CREATE INDEX "job_listings_postedAt_idx" ON "public"."job_listings"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_listings_sourceId_externalId_key" ON "public"."job_listings"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_jobs_userId_jobListingId_key" ON "public"."saved_jobs"("userId", "jobListingId");

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_applications" ADD CONSTRAINT "membership_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_applications" ADD CONSTRAINT "membership_applications_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "public"."membership_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_periods" ADD CONSTRAINT "membership_periods_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "public"."memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."membership_periods" ADD CONSTRAINT "membership_periods_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "public"."discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."topics" ADD CONSTRAINT "topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "questions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."questions" ADD CONSTRAINT "questions_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."question_reviews" ADD CONSTRAINT "question_reviews_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."question_reviews" ADD CONSTRAINT "question_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exam_entitlements" ADD CONSTRAINT "exam_entitlements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exam_entitlements" ADD CONSTRAINT "exam_entitlements_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."exam_entitlements" ADD CONSTRAINT "exam_entitlements_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attempts" ADD CONSTRAINT "attempts_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "public"."exam_entitlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attempt_questions" ADD CONSTRAINT "attempt_questions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attempt_questions" ADD CONSTRAINT "attempt_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."question_exposures" ADD CONSTRAINT "question_exposures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."question_exposures" ADD CONSTRAINT "question_exposures_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."certificates" ADD CONSTRAINT "certificates_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "public"."attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."courses" ADD CONSTRAINT "courses_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discount_codes" ADD CONSTRAINT "discount_codes_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discount_codes" ADD CONSTRAINT "discount_codes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discount_redemptions" ADD CONSTRAINT "discount_redemptions_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "public"."discount_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discount_redemptions" ADD CONSTRAINT "discount_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."notification_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_campaigns" ADD CONSTRAINT "notification_campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."invitations" ADD CONSTRAINT "invitations_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resources" ADD CONSTRAINT "resources_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_listings" ADD CONSTRAINT "job_listings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."job_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_jobs" ADD CONSTRAINT "saved_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_jobs" ADD CONSTRAINT "saved_jobs_jobListingId_fkey" FOREIGN KEY ("jobListingId") REFERENCES "public"."job_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
