-- Memberships now last one full year from the payment date instead of ending
-- on 31 December. Correct every period that was cut short at year end so it
-- runs to the same date the following year.

UPDATE "membership_periods"
SET "periodEnd" = "periodStart" + INTERVAL '1 year'
WHERE EXTRACT(MONTH FROM "periodEnd") = 12
  AND EXTRACT(DAY FROM "periodEnd") = 31
  AND EXTRACT(YEAR FROM "periodEnd") = EXTRACT(YEAR FROM "periodStart");

UPDATE "memberships"
SET "currentPeriodEnd" = "currentPeriodStart" + INTERVAL '1 year'
WHERE "currentPeriodStart" IS NOT NULL
  AND "currentPeriodEnd" IS NOT NULL
  AND EXTRACT(MONTH FROM "currentPeriodEnd") = 12
  AND EXTRACT(DAY FROM "currentPeriodEnd") = 31
  AND EXTRACT(YEAR FROM "currentPeriodEnd") = EXTRACT(YEAR FROM "currentPeriodStart");

-- Exam chances bought with a subscription follow that subscription's year.
UPDATE "exam_entitlements" e
SET "expiresAt" = p."periodEnd"
FROM "membership_periods" p
WHERE e."source" = 'SUBSCRIPTION'
  AND e."paymentId" IS NOT NULL
  AND e."paymentId" = p."paymentId";

-- A member who was marked lapsed only because the year-end cut-off passed
-- is active again if their full year has not run out.
UPDATE "memberships"
SET "status" = 'ACTIVE', "lapsedAt" = NULL
WHERE "status" = 'LAPSED'
  AND "currentPeriodEnd" > NOW();
