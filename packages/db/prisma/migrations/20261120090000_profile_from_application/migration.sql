-- Personal details are now collected only in the membership application and
-- copied to the profile on submit. Fill existing profiles from each member's
-- latest submitted application so nothing has to be typed in again.
WITH latest AS (
  SELECT DISTINCT ON ("userId") "userId", answers
  FROM "membership_applications"
  WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DECLINED')
  ORDER BY "userId", "submittedAt" DESC NULLS LAST, "updatedAt" DESC
)
INSERT INTO "profiles" ("id", "userId", "gender", "yearOfGraduation", "addressLine1", "addressLine2", "city", "stateProvince", "postalCode", "country", "highestQualification", "occupation", "employer", "institution", "institutionLevel", "programOfStudy", "updatedAt")
SELECT
  'pf' || substr(md5(random()::text || l."userId"), 1, 23),
  l."userId",
  CASE WHEN l.answers->>'gender' IN ('MALE', 'FEMALE', 'UNSPECIFIED') THEN (l.answers->>'gender')::"Gender" ELSE 'UNSPECIFIED'::"Gender" END,
  CASE WHEN l.answers->>'yearOfGraduation' ~ '^[0-9]{4}$' THEN (l.answers->>'yearOfGraduation')::int ELSE NULL END,
  NULLIF(btrim(l.answers->>'addressLine1'), ''),
  NULLIF(btrim(l.answers->>'addressLine2'), ''),
  NULLIF(btrim(l.answers->>'city'), ''),
  NULLIF(btrim(l.answers->>'stateProvince'), ''),
  NULLIF(btrim(l.answers->>'postalCode'), ''),
  NULLIF(btrim(l.answers->>'country'), ''),
  NULLIF(btrim(l.answers->>'highestQualification'), ''),
  NULLIF(btrim(l.answers->>'occupation'), ''),
  NULLIF(btrim(l.answers->>'employer'), ''),
  NULLIF(btrim(l.answers->>'institution'), ''),
  NULLIF(btrim(l.answers->>'institutionLevel'), ''),
  NULLIF(btrim(l.answers->>'programOfStudy'), ''),
  NOW()
FROM latest l
ON CONFLICT ("userId") DO UPDATE SET
  "gender" = CASE WHEN EXCLUDED."gender" <> 'UNSPECIFIED' THEN EXCLUDED."gender" ELSE profiles."gender" END,
  "yearOfGraduation" = COALESCE(EXCLUDED."yearOfGraduation", profiles."yearOfGraduation"),
  "addressLine1" = COALESCE(EXCLUDED."addressLine1", profiles."addressLine1"),
  "addressLine2" = COALESCE(EXCLUDED."addressLine2", profiles."addressLine2"),
  "city" = COALESCE(EXCLUDED."city", profiles."city"),
  "stateProvince" = COALESCE(EXCLUDED."stateProvince", profiles."stateProvince"),
  "postalCode" = COALESCE(EXCLUDED."postalCode", profiles."postalCode"),
  "country" = COALESCE(EXCLUDED."country", profiles."country"),
  "highestQualification" = COALESCE(EXCLUDED."highestQualification", profiles."highestQualification"),
  "occupation" = COALESCE(EXCLUDED."occupation", profiles."occupation"),
  "employer" = COALESCE(EXCLUDED."employer", profiles."employer"),
  "institution" = COALESCE(EXCLUDED."institution", profiles."institution"),
  "institutionLevel" = COALESCE(EXCLUDED."institutionLevel", profiles."institutionLevel"),
  "programOfStudy" = COALESCE(EXCLUDED."programOfStudy", profiles."programOfStudy"),
  "updatedAt" = NOW();
