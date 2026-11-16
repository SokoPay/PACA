-- AlterTable
ALTER TABLE "public"."announcements" ADD COLUMN "discountCode" TEXT;

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "registerUrl" TEXT,
    "priceText" TEXT,
    "memberDiscountPercent" INTEGER,
    "memberDiscountCode" TEXT,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "public"."events"("slug");

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "public"."events"("status", "startsAt");
