-- CreateEnum
CREATE TYPE "public"."RedemptionChannel" AS ENUM ('PACA_CHECKOUT', 'PARTNER_API');

-- AlterTable
ALTER TABLE "public"."discount_redemptions" ADD COLUMN     "channel" "public"."RedemptionChannel" NOT NULL DEFAULT 'PACA_CHECKOUT',
ADD COLUMN     "externalReference" TEXT,
ADD COLUMN     "partnerId" TEXT;

-- CreateTable
CREATE TABLE "public"."partner_api_keys" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_api_keys_keyHash_key" ON "public"."partner_api_keys"("keyHash");

-- CreateIndex
CREATE INDEX "partner_api_keys_partnerId_idx" ON "public"."partner_api_keys"("partnerId");

-- CreateIndex
CREATE INDEX "discount_redemptions_partnerId_redeemedAt_idx" ON "public"."discount_redemptions"("partnerId", "redeemedAt");

-- AddForeignKey
ALTER TABLE "public"."partner_api_keys" ADD CONSTRAINT "partner_api_keys_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discount_redemptions" ADD CONSTRAINT "discount_redemptions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
