import type { StaticImageData } from "next/image";
import studentBadge from "@/images/pacastudentbadge.jpeg";
import professionalBadge from "@/images/pacaprofbadge.jpeg";
import executiveBadge from "@/images/pacaexecbadge.jpeg";
import fellowBadge from "@/images/pacafellowbadge.jpeg";
import scrumOrgLogo from "@/images/scrumpartner.jpeg";
import scrumOrgSmall from "@/images/scrumsmallpartner.jpeg";
import proKanbanLogo from "@/images/kanbanpartner.jpeg";
import proKanbanSmall from "@/images/kanbansmallpartner.jpeg";
import scrumAllianceLogo from "@/images/scrumalliancepartner.jpeg";
import scrumAllianceSmall from "@/images/scrumalliancesmallpartner.jpeg";

export interface Badge {
  tier: "STUDENT" | "PROFESSIONAL" | "EXECUTIVE" | "FELLOW";
  slug: string;
  name: string;
  image: StaticImageData;
  summary: string;
}

/** PACA certification badges, in career order. (Retired members have no badge of their own.) */
export const BADGES: Badge[] = [
  {
    tier: "STUDENT",
    slug: "student",
    name: "PACA Student",
    image: studentBadge,
    summary: "For students starting out in Agile. Proves you know the foundations.",
  },
  {
    tier: "PROFESSIONAL",
    slug: "professional",
    name: "PACA Professional Member",
    image: professionalBadge,
    summary: "For practitioners who apply Agile, Scrum and Kanban at work every day.",
  },
  {
    tier: "EXECUTIVE",
    slug: "executive",
    name: "PACA Executive Member",
    image: executiveBadge,
    summary: "For leaders who drive Agile transformation across teams and organisations.",
  },
  {
    tier: "FELLOW",
    slug: "fellow",
    name: "PACA Fellow Member",
    image: fellowBadge,
    summary: "PACA's highest honour, awarded by panel for outstanding contribution to Agile.",
  },
];

export function badgeFor(tier: string): Badge | undefined {
  return BADGES.find((b) => b.tier === tier.toUpperCase() || b.slug === tier.toLowerCase());
}

export interface PartnerBrand {
  name: string;
  url: string;
  logo: StaticImageData; // square/large, for the partners page and home page
  small: StaticImageData; // wide, for the footer
  description: string;
}

export const PARTNERS: PartnerBrand[] = [
  {
    name: "Scrum.org",
    url: "https://www.scrum.org",
    logo: scrumOrgLogo,
    small: scrumOrgSmall,
    description: "Professional Scrum training, assessments and certification.",
  },
  {
    name: "ProKanban.org",
    url: "https://www.prokanban.org",
    logo: proKanbanLogo,
    small: proKanbanSmall,
    description: "Professional Kanban training and the Kanban Guide community.",
  },
  {
    name: "Scrum Alliance",
    url: "https://www.scrumalliance.org",
    logo: scrumAllianceLogo,
    small: scrumAllianceSmall,
    description: "Agile and Scrum certifications, education and community.",
  },
];
