/**
 * Tier-specific application forms.
 *
 * The field definitions here are the SINGLE source of truth: the API validates
 * against them and the web app renders its form from them (served by
 * GET /membership/tiers). Duplicating field lists in the frontend is how forms
 * drift out of sync with the validation that actually protects the database.
 *
 * Field sets mirror the live pac-a.org application forms per tier.
 */
import { z } from "zod";
import type { DocumentKind, MembershipTier } from "@prisma/client";

export type FieldType = "text" | "textarea" | "select" | "number" | "email" | "tel";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface DocumentRequirement {
  kind: DocumentKind;
  label: string;
  required: boolean;
  help?: string;
}

export interface TierForm {
  sections: Array<{ title: string; fields: FieldDef[] }>;
  documents: DocumentRequirement[];
}

const GENDER: FieldDef = {
  name: "gender",
  label: "Gender",
  type: "select",
  required: false,
  options: [
    { value: "MALE", label: "Male" },
    { value: "FEMALE", label: "Female" },
    { value: "UNSPECIFIED", label: "Prefer not to say" },
  ],
};

/** Contact block is common to every tier — it mirrors the current site's forms. */
const CONTACT_FIELDS: FieldDef[] = [
  { name: "addressLine1", label: "Street address", type: "text", required: true, maxLength: 200 },
  { name: "addressLine2", label: "Apartment, suite (optional)", type: "text", required: false, maxLength: 200 },
  { name: "city", label: "City", type: "text", required: true, maxLength: 120 },
  { name: "stateProvince", label: "State / Province", type: "text", required: false, maxLength: 120 },
  { name: "postalCode", label: "ZIP / Postal code", type: "text", required: false, maxLength: 32 },
  {
    name: "country",
    label: "Country",
    type: "text",
    required: true,
    maxLength: 2,
    help: "Two-letter country code, e.g. GH",
  },
  GENDER,
];

const PROFESSIONAL_FIELDS: FieldDef[] = [
  { name: "highestQualification", label: "Highest educational qualification", type: "text", required: true, maxLength: 200 },
  {
    name: "yearOfGraduation",
    label: "Year of graduation",
    type: "number",
    required: true,
    min: 1940,
    max: new Date().getFullYear(),
  },
  { name: "occupation", label: "Occupation", type: "text", required: true, maxLength: 200 },
  { name: "employer", label: "Employer / Organisation", type: "text", required: false, maxLength: 200 },
];

const REFEREE_FIELDS: FieldDef[] = [
  { name: "referee1Name", label: "Referee 1 — full name", type: "text", required: true, maxLength: 160 },
  { name: "referee1Email", label: "Referee 1 — email", type: "email", required: true, maxLength: 320 },
  { name: "referee2Name", label: "Referee 2 — full name", type: "text", required: true, maxLength: 160 },
  { name: "referee2Email", label: "Referee 2 — email", type: "email", required: true, maxLength: 320 },
];

const PROFESSIONAL_DOCS: DocumentRequirement[] = [
  {
    kind: "PROFESSIONAL_CERTIFICATE",
    label: "Professional or educational certificate",
    required: true,
    help: "PDF or image, up to 10 MB",
  },
  { kind: "CV", label: "Current CV", required: true, help: "Must include two contactable references" },
];

export const TIER_FORMS: Record<MembershipTier, TierForm> = {
  STUDENT: {
    sections: [
      { title: "Contact details", fields: CONTACT_FIELDS },
      {
        title: "Your studies",
        fields: [
          { name: "institution", label: "University / tertiary institution", type: "text", required: true, maxLength: 200 },
          {
            name: "institutionLevel",
            label: "Level",
            type: "select",
            required: true,
            options: ["100", "200", "300", "400"].map((v) => ({ value: v, label: `Level ${v}` })),
          },
          { name: "programOfStudy", label: "Programme of study", type: "text", required: true, maxLength: 200 },
          {
            name: "motivation",
            label: "Why do you want to join PACA?",
            type: "textarea",
            required: false,
            maxLength: 1500,
            help: "Tell us about your interest in Agile, Scrum, Kanban, Lean, Design Thinking or XP.",
          },
        ],
      },
    ],
    documents: [
      { kind: "STUDENT_ID", label: "Valid student ID", required: true },
      {
        kind: "RECOMMENDATION_LETTER",
        label: "Recommendation letter",
        required: true,
        help: "Signed by your head of department or a senior lecturer",
      },
    ],
  },

  PROFESSIONAL: {
    sections: [
      { title: "Contact details", fields: CONTACT_FIELDS },
      { title: "Professional background", fields: PROFESSIONAL_FIELDS },
      { title: "References", fields: REFEREE_FIELDS },
    ],
    documents: PROFESSIONAL_DOCS,
  },

  EXECUTIVE: {
    sections: [
      { title: "Contact details", fields: CONTACT_FIELDS },
      { title: "Professional background", fields: PROFESSIONAL_FIELDS },
      {
        title: "Leadership experience",
        fields: [
          {
            name: "leadershipExperience",
            label: "Describe your leadership or governance responsibility",
            type: "textarea",
            required: true,
            maxLength: 3000,
            help: "Include scope of decision-making authority and the scale of organisations involved.",
          },
          { name: "yearsInLeadership", label: "Years in a leadership role", type: "number", required: true, min: 0, max: 60 },
        ],
      },
      { title: "References", fields: REFEREE_FIELDS },
    ],
    documents: PROFESSIONAL_DOCS,
  },

  FELLOW: {
    sections: [
      { title: "Contact details", fields: CONTACT_FIELDS },
      { title: "Professional background", fields: PROFESSIONAL_FIELDS },
      {
        title: "Contribution to the Agile field",
        fields: [
          { name: "yearsInField", label: "Years of practice in Agile", type: "number", required: true, min: 10, max: 60 },
          {
            name: "contributions",
            label: "Books, articles, blogs and other contributions",
            type: "textarea",
            required: true,
            maxLength: 5000,
            help: "Fellowship is assessed by a panel of academic and industry leaders. List publications with links where possible.",
          },
          { name: "publicationLinks", label: "Links to published work", type: "textarea", required: false, maxLength: 2000 },
        ],
      },
      { title: "References", fields: REFEREE_FIELDS },
    ],
    documents: [
      ...PROFESSIONAL_DOCS,
      { kind: "PUBLICATION", label: "Sample publication", required: false, help: "A representative book chapter, paper or article" },
    ],
  },

  RETIRED: {
    sections: [
      { title: "Contact details", fields: CONTACT_FIELDS },
      { title: "Professional background", fields: PROFESSIONAL_FIELDS },
      {
        title: "Previous PACA membership",
        fields: [
          {
            name: "previousTier",
            label: "Membership previously held",
            type: "select",
            required: true,
            options: [
              { value: "PROFESSIONAL", label: "PACA Professional" },
              { value: "EXECUTIVE", label: "PACA Executive" },
              { value: "FELLOW", label: "PACA Fellow" },
            ],
          },
          {
            name: "previousMemberNumber",
            label: "Previous member number (if known)",
            type: "text",
            required: false,
            maxLength: 40,
          },
          {
            name: "yearRetired",
            label: "Year you retired from active employment",
            type: "number",
            required: true,
            min: 1960,
            max: new Date().getFullYear(),
          },
        ],
      },
    ],
    documents: [
      { kind: "PROOF_OF_RETIREMENT", label: "Evidence of retirement", required: true },
      { kind: "CV", label: "Career summary or CV", required: false },
    ],
  },
};

/** Build a Zod schema for a tier from its field definitions. */
export function schemaForTier(tier: MembershipTier): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const section of TIER_FORMS[tier].sections) {
    for (const f of section.fields) {
      let field: z.ZodTypeAny;

      switch (f.type) {
        case "number":
          field = z.coerce.number().int();
          if (f.min !== undefined) field = (field as z.ZodNumber).min(f.min);
          if (f.max !== undefined) field = (field as z.ZodNumber).max(f.max);
          break;
        case "email":
          field = z.string().email().max(f.maxLength ?? 320);
          break;
        case "select":
          field = z.enum((f.options ?? []).map((o) => o.value) as [string, ...string[]]);
          break;
        default:
          field = z.string().max(f.maxLength ?? 500);
          if (f.required) field = (field as z.ZodString).min(1, `${f.label} is required`);
      }

      // Optional fields accept an empty string from the form and normalise to undefined.
      shape[f.name] = f.required ? field : z.preprocess((v) => (v === "" || v === null ? undefined : v), field.optional());
    }
  }

  return z.object(shape).strict();
}

/** Documents a tier cannot be submitted without. */
export function requiredDocuments(tier: MembershipTier): DocumentKind[] {
  return TIER_FORMS[tier].documents.filter((d) => d.required).map((d) => d.kind);
}
