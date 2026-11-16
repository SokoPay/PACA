import type { Prisma } from "@prisma/client";
import type { PrismaService } from "./prisma.service";

/**
 * Personal details (address, gender, education, work) are collected ONCE, in
 * the membership application. When an application is submitted, those answers
 * are copied onto the member's profile — which feeds the professional network
 * and the admin views — so nobody is asked for the same thing twice.
 * The profile page itself only collects what the application does not:
 * LinkedIn link, bio and the network opt-in.
 */
const TEXT_FIELDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "stateProvince",
  "postalCode",
  "country",
  "highestQualification",
  "occupation",
  "employer",
  "institution",
  "institutionLevel",
  "programOfStudy",
] as const;

export async function syncProfileFromAnswers(prisma: PrismaService, userId: string, answers: unknown): Promise<void> {
  if (!answers || typeof answers !== "object") return;
  const a = answers as Record<string, unknown>;
  const data: Prisma.ProfileUncheckedUpdateInput = {};
  for (const f of TEXT_FIELDS) {
    const v = a[f];
    if (typeof v === "string" && v.trim()) data[f] = v.trim();
    else if (typeof v === "number") data[f] = String(v);
  }
  const year = Number(a.yearOfGraduation);
  if (Number.isInteger(year) && year > 1900) data.yearOfGraduation = year;
  if (a.gender === "MALE" || a.gender === "FEMALE" || a.gender === "UNSPECIFIED") data.gender = a.gender;
  if (Object.keys(data).length === 0) return;
  await prisma.profile.upsert({
    where: { userId },
    update: data,
    create: { ...(data as Prisma.ProfileUncheckedCreateInput), userId },
  });
}
