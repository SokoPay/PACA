/**
 * Course catalogue for "Explore courses".
 *
 * Partner courses mirror each partner's public course list (titles, levels and
 * links as published by the partner; summaries are PACA's own short wording).
 * Members take the course on the partner's site — PACA's part is the member
 * discount, which admins set per partner once it's agreed (Admin → Partners).
 */

export type PartnerSlug = "scrum-alliance" | "prokanban" | "scrum-org";

export interface PartnerCourse {
  slug: string;
  partner: PartnerSlug;
  title: string;
  acronym?: string;
  /** Section heading on the partner page (track, or delivery type). */
  group: string;
  level?: "Foundational" | "Advanced" | "Professional";
  format?: string;
  duration?: string;
  audience?: string;
  prerequisites?: string;
  certification?: string;
  summary: string;
  url: string;
  datesUrl?: string;
}

export interface PartnerInfo {
  slug: PartnerSlug;
  name: string;
  tagline: string;
  about: string;
  catalogueUrl: string;
  /** Order of the groups on the partner page. */
  groups: string[];
}

export const PARTNER_INFO: PartnerInfo[] = [
  {
    slug: "scrum-org",
    name: "Scrum.org",
    tagline: "Professional Scrum training and certification",
    about:
      "Scrum.org offers Professional Scrum courses taught by licensed trainers, live or self-paced, each preparing you for its Professional Scrum assessment.",
    catalogueUrl: "https://www.scrum.org/all-courses",
    groups: ["Instructor-led courses", "Self-paced courses"],
  },
  {
    slug: "prokanban",
    name: "ProKanban.org",
    tagline: "Professional Kanban and flow metrics",
    about:
      "ProKanban.org runs live, instructor-led two-day classes on Kanban, flow metrics and predictable delivery, each leading to a professional certification.",
    catalogueUrl: "https://prokanban.org/courses-overview",
    groups: ["Live instructor-led courses"],
  },
  {
    slug: "scrum-alliance",
    name: "Scrum Alliance",
    tagline: "Role-based and skill-based Agile certifications",
    about:
      "Scrum Alliance certifications follow career tracks from Foundational to Advanced to Professional, for Scrum Masters, Product Owners, Developers and Agile leaders.",
    catalogueUrl: "https://www.scrumalliance.org/get-certified",
    groups: ["Scrum Master track", "Product Owner track", "Developer track", "Facilitation", "Leadership", "Scaling"],
  },
];

const SA = "https://www.scrumalliance.org/get-certified";
const SO = "https://www.scrum.org";
const PK = "https://prokanban.org";

export const PARTNER_COURSES: PartnerCourse[] = [
  // ------------------------------------------------------------------ Scrum Alliance
  { partner: "scrum-alliance", slug: "csm", acronym: "CSM", title: "Certified ScrumMaster®", group: "Scrum Master track", level: "Foundational", duration: "16+ hours", prerequisites: "None", summary: "The Scrum framework, its roles, events and artifacts, and how to put them to work with a team.", url: `${SA}/scrum-master-track/certified-scrummaster` },
  { partner: "scrum-alliance", slug: "a-csm", acronym: "A-CSM", title: "Advanced Certified ScrumMaster®", group: "Scrum Master track", level: "Advanced", duration: "16+ hours", prerequisites: "CSM", summary: "Builds on CSM with facilitation, team engagement and working with Scrum beyond a single team.", url: `${SA}/scrum-master-track/advanced-certified-scrummaster` },
  { partner: "scrum-alliance", slug: "csp-sm", acronym: "CSP-SM", title: "Certified Scrum Professional® – ScrumMaster", group: "Scrum Master track", level: "Professional", prerequisites: "CSM and A-CSM", summary: "Advanced coaching, mentoring and facilitation for experienced Scrum Masters.", url: `${SA}/scrum-master-track/certified-scrum-professional-scrummaster` },
  { partner: "scrum-alliance", slug: "cspo", acronym: "CSPO", title: "Certified Scrum Product Owner®", group: "Product Owner track", level: "Foundational", duration: "16+ hours", prerequisites: "None", summary: "Product vision, backlog prioritisation and working with stakeholders as a Product Owner.", url: `${SA}/product-owner-track/certified-scrum-product-owner` },
  { partner: "scrum-alliance", slug: "a-cspo", acronym: "A-CSPO", title: "Advanced Certified Scrum Product Owner®", group: "Product Owner track", level: "Advanced", prerequisites: "CSPO", summary: "Balancing competing initiatives, evolving product strategy and validating business value.", url: `${SA}/product-owner-track/advanced-certified-scrum-product-owner` },
  { partner: "scrum-alliance", slug: "csp-po", acronym: "CSP-PO", title: "Certified Scrum Professional® – Product Owner", group: "Product Owner track", level: "Professional", prerequisites: "A-CSPO", summary: "Customer research, testing product assumptions and market-driven product strategy.", url: `${SA}/product-owner-track/certified-scrum-professional-product-owner` },
  { partner: "scrum-alliance", slug: "csd", acronym: "CSD", title: "Certified Scrum Developer®", group: "Developer track", level: "Foundational", duration: "16+ hours", prerequisites: "None", summary: "Scrum alongside engineering practices such as architecture, refactoring and test-driven development.", url: `${SA}/developer-track/certified-scrum-developer` },
  { partner: "scrum-alliance", slug: "a-csd", acronym: "A-CSD", title: "Advanced Certified Scrum Developer®", group: "Developer track", level: "Advanced", prerequisites: "CSD", summary: "Visualising workflow, a strong Definition of Done, CI/CD and advanced technical practices.", url: `${SA}/developer-track/advanced-certified-scrum-developer` },
  { partner: "scrum-alliance", slug: "csp-d", acronym: "CSP-D", title: "Certified Scrum Professional® – Developer", group: "Developer track", level: "Professional", prerequisites: "A-CSD", summary: "Technical excellence, team learning and growing as a technical Agile leader.", url: `${SA}/developer-track/certified-scrum-professional-for-developers` },
  { partner: "scrum-alliance", slug: "caf", acronym: "CAF", title: "Certified Agile Facilitator™", group: "Facilitation", level: "Foundational", duration: "16+ hours", prerequisites: "None", summary: "The facilitator mindset, handling conflict and adapting facilitation to the group in front of you.", url: `${SA}/certified-agile-facilitator` },
  { partner: "scrum-alliance", slug: "cal-1", acronym: "CAL 1", title: "Certified Agile Leader® 1", group: "Leadership", level: "Foundational", duration: "16+ hours", prerequisites: "None", summary: "Leading for results in unpredictable environments and building adaptive teams.", url: `${SA}/agile-leader/cal-1` },
  { partner: "scrum-alliance", slug: "cal-2", acronym: "CAL 2", title: "Certified Agile Leader® 2", group: "Leadership", level: "Advanced", duration: "16+ hours", prerequisites: "CAL 1", summary: "Organisational design, leading change and growing leadership capability across the organisation.", url: `${SA}/agile-leader-track/cal-2` },
  { partner: "scrum-alliance", slug: "casp", acronym: "CASP", title: "Certified Agile Scaling Practitioner™", group: "Scaling", level: "Foundational", prerequisites: "None", summary: "Scaling Agile delivery across multiple teams and sites.", url: `${SA}/certified-agile-scaling-practitioner` },

  // ------------------------------------------------------------------ ProKanban.org
  { partner: "prokanban", slug: "apk", acronym: "APK", title: "Applying Professional Kanban", group: "Live instructor-led courses", format: "Live, instructor-led", duration: "2 days", audience: "Practitioners, team leads, Scrum Masters", prerequisites: "None", certification: "PK I", summary: "Kanban principles and the core flow metrics, ready to use with your team the next day.", url: `${PK}/events-category/apk`, datesUrl: `${PK}/training?course=APK` },
  { partner: "prokanban", slug: "afms", acronym: "AFMS", title: "Applying Flow Metrics for Scrum", group: "Live instructor-led courses", format: "Live, instructor-led", duration: "2 days", audience: "Scrum Masters, Agile coaches", prerequisites: "Working Scrum practice", certification: "PFMS", summary: "Brings flow metrics into Scrum events so Sprint decisions are based on data.", url: `${PK}/events-category/afms`, datesUrl: `${PK}/training?course=AFMS` },
  { partner: "prokanban", slug: "amp", acronym: "AMP", title: "Applying Metrics for Predictability", group: "Live instructor-led courses", format: "Live, instructor-led", duration: "2 days", audience: "Delivery leads, engineering managers", prerequisites: "APK or equivalent flow basics", certification: "PAM", summary: "Uses your delivery data to forecast and make delivery more predictable.", url: `${PK}/events-category/amp`, datesUrl: `${PK}/training?course=AMP` },
  { partner: "prokanban", slug: "aspk", acronym: "ASPK", title: "Applying Scaled Portfolio Kanban", group: "Live instructor-led courses", format: "Live, instructor-led", duration: "2 days", audience: "Portfolio leads, senior managers", prerequisites: "Kanban basics", certification: "SPK", summary: "Managing flow across many projects and portfolio items at once.", url: `${PK}/events-category/aspk`, datesUrl: `${PK}/training?course=ASPK` },
  { partner: "prokanban", slug: "apv", acronym: "APV", title: "Accelerating Product Value", group: "Live instructor-led courses", format: "Live, instructor-led", duration: "2 days", audience: "Product managers, Product Owners", prerequisites: "Familiarity with flow metrics", certification: "PVA", summary: "Uses flow metrics to manage return on product investment and shorten customer feedback loops.", url: `${PK}/events-category/apv`, datesUrl: `${PK}/training?course=APV` },

  // ------------------------------------------------------------------ Scrum.org — instructor-led
  { partner: "scrum-org", slug: "aps", acronym: "APS", title: "Applying Professional Scrum", group: "Instructor-led courses", format: "Instructor-led", summary: "Learn Scrum by doing it: work in Scrum Teams across a series of Sprints.", url: `${SO}/courses/applying-professional-scrum-training` },
  { partner: "scrum-org", slug: "aps-sd", acronym: "APS-SD", title: "Applying Professional Scrum for Software Development", group: "Instructor-led courses", format: "Instructor-led", summary: "Delivering software with Scrum, modern Agile engineering and DevOps practices.", url: `${SO}/courses/applying-professional-scrum-for-software-development-training` },
  { partner: "scrum-org", slug: "psm", acronym: "PSM", title: "Professional Scrum Master", group: "Instructor-led courses", format: "Instructor-led", certification: "PSM I", summary: "Scrum and the Scrum Master accountabilities, with a strong focus on applying them.", url: `${SO}/courses/professional-scrum-master-training` },
  { partner: "scrum-org", slug: "psm-a", acronym: "PSM-A", title: "Professional Scrum Master – Advanced", group: "Instructor-led courses", format: "Instructor-led", certification: "PSM II", summary: "Deeper Scrum Master challenges: serving the team, the Product Owner and the organisation.", url: `${SO}/courses/professional-scrum-master-advanced-training` },
  { partner: "scrum-org", slug: "psm-ai", acronym: "PSM-AI", title: "Professional Scrum Master™ – AI Essentials", group: "Instructor-led courses", format: "Instructor-led", duration: "1 day", summary: "Practical AI for Scrum Masters, and helping teams use AI well.", url: `${SO}/courses/professional-scrum-master-ai-essentials-training` },
  { partner: "scrum-org", slug: "pspo", acronym: "PSPO", title: "Professional Scrum Product Owner", group: "Instructor-led courses", format: "Instructor-led", certification: "PSPO I", summary: "Product Owner accountabilities and connecting strategy with product management.", url: `${SO}/courses/professional-scrum-product-owner-training` },
  { partner: "scrum-org", slug: "pspo-a", acronym: "PSPO-A", title: "Professional Scrum Product Owner – Advanced", group: "Instructor-led courses", format: "Instructor-led", certification: "PSPO II", summary: "For experienced Product Owners: vision, validating hypotheses and product leadership.", url: `${SO}/courses/professional-scrum-product-owner-advanced-mastering-product-owner-stances-training` },
  { partner: "scrum-org", slug: "pspo-ai", acronym: "PSPO-AI", title: "Professional Scrum Product Owner™ – AI Essentials", group: "Instructor-led courses", format: "Instructor-led", duration: "1 day", summary: "Using AI across the Product Owner stances, including ethics and security.", url: `${SO}/courses/professional-scrum-product-owner-ai-essentials-training` },
  { partner: "scrum-org", slug: "pspbm", acronym: "PSPBMS", title: "Professional Scrum Product Backlog Management Skills™", group: "Instructor-led courses", format: "Instructor-led", summary: "Techniques for a transparent, value-focused Product Backlog.", url: `${SO}/courses/professional-scrum-product-backlog-management-skills-training` },
  { partner: "scrum-org", slug: "pal-e", acronym: "PAL-E", title: "Professional Agile Leadership Essentials", group: "Instructor-led courses", format: "Instructor-led", certification: "PAL I", summary: "For managers and leaders: how to support, coach and lead Agile teams.", url: `${SO}/courses/professional-agile-leadership-essentials-training` },
  { partner: "scrum-org", slug: "pal-ebm", acronym: "PAL-EBM", title: "Professional Agile Leadership – Evidence-Based Management", group: "Instructor-led courses", format: "Instructor-led", certification: "PAL-EBM", summary: "Setting goals and measures with Evidence-Based Management to improve outcomes.", url: `${SO}/courses/professional-agile-leadership-evidence-based-management-training` },
  { partner: "scrum-org", slug: "psfs", acronym: "PSFS", title: "Professional Scrum Facilitation Skills™", group: "Instructor-led courses", format: "Instructor-led", summary: "Facilitation skills that help Scrum Teams solve problems and reach shared understanding.", url: `${SO}/courses/professional-scrum-facilitation-skills-training` },
  { partner: "scrum-org", slug: "ppdv", acronym: "PPDV", title: "Professional Product Discovery and Validation", group: "Instructor-led courses", format: "Instructor-led", duration: "1 day", summary: "Hands-on product discovery and validation techniques.", url: `${SO}/courses/professional-product-discovery-and-validation-training` },
  { partner: "scrum-org", slug: "psk", acronym: "PSK", title: "Professional Scrum™ with Kanban", group: "Instructor-led courses", format: "Instructor-led", certification: "PSK I", summary: "Applying Kanban practices inside Professional Scrum to improve flow.", url: `${SO}/courses/professional-scrum-with-kanban-training` },
  { partner: "scrum-org", slug: "psu", acronym: "PSU", title: "Professional Scrum with User Experience", group: "Instructor-led courses", format: "Instructor-led", certification: "PSU I", summary: "Bringing UX and Scrum together so cross-functional teams deliver better outcomes for users.", url: `${SO}/courses/professional-scrum-user-experience-training` },
  { partner: "scrum-org", slug: "sps", acronym: "SPS", title: "Scaled Professional Scrum", group: "Instructor-led courses", format: "Instructor-led", certification: "SPS", summary: "Scaling Scrum beyond one team with the Nexus framework, in a simulated project.", url: `${SO}/courses/scaled-professional-scrum-nexus-training` },
  { partner: "scrum-org", slug: "psmpo", acronym: "PSMPO", title: "Professional Scrum Master™ and Product Owner", group: "Instructor-led courses", format: "Instructor-led (private classes)", summary: "A combined class covering the key goals of the PSM and PSPO courses, for company teams.", url: `${SO}/courses/professional-scrum-master-and-product-owner-training` },

  // ------------------------------------------------------------------ Scrum.org — self-paced
  { partner: "scrum-org", slug: "psm-self-paced", acronym: "PSM", title: "Professional Scrum Master™ (self-paced)", group: "Self-paced courses", format: "Self-paced online", certification: "PSM I", summary: "Interactive online course for newcomers and anyone strengthening their Scrum skills.", url: `${SO}/all-courses/self-paced/professional-scrum-master` },
  { partner: "scrum-org", slug: "psm-a-self-paced", acronym: "PSM-A", title: "Professional Scrum Master™ – Advanced (self-paced)", group: "Self-paced courses", format: "Self-paced online", certification: "PSM II", summary: "The mix of skills a Scrum Master needs to support the team and the organisation.", url: `${SO}/all-courses/self-paced/professional-scrum-master-advanced` },
  { partner: "scrum-org", slug: "pspo-self-paced", acronym: "PSPO", title: "Professional Scrum Product Owner™ (self-paced)", group: "Self-paced courses", format: "Self-paced online", certification: "PSPO I", summary: "Interactive online course for Product Owners and product managers.", url: `${SO}/all-courses/self-paced/professional-scrum-product-owner` },
  { partner: "scrum-org", slug: "pspbm-self-paced", acronym: "PSPBMS", title: "Professional Scrum Product Backlog Management Skills™ (self-paced)", group: "Self-paced courses", format: "Self-paced online", summary: "The backlog management course, at your own pace.", url: `${SO}/all-courses/self-paced/professional-scrum-product-backlog-management-skills` },
  { partner: "scrum-org", slug: "stakeholder-collaboration", title: "Effective Stakeholder Collaboration for Scrum Teams™", group: "Self-paced courses", format: "Self-paced online", summary: "Building trust and shared ownership with stakeholders.", url: `${SO}/all-courses/self-paced/effective-stakeholder-collaboration-scrum-teams` },
  { partner: "scrum-org", slug: "leading-agile-teams", title: "Leading Agile Teams™", group: "Self-paced courses", format: "Self-paced online", summary: "Leadership skills including time management, delegation and self-reflection.", url: `${SO}/all-courses/self-paced/leading-agile-teams` },
  { partner: "scrum-org", slug: "estimation-planning", title: "Estimation and Planning for Scrum Teams™", group: "Self-paced courses", format: "Self-paced online", summary: "Estimating, planning and forecasting with data-driven techniques.", url: `${SO}/all-courses/self-paced/estimation-and-planning-scrum-teams` },
  { partner: "scrum-org", slug: "backlog-refinement", title: "Product Backlog Refinement™", group: "Self-paced courses", format: "Self-paced microlearning", summary: "A short course on refinement as an ongoing Scrum activity.", url: `${SO}/all-courses/self-paced/product-backlog-refinement` },
  { partner: "scrum-org", slug: "ai-fluency", acronym: "AIF I", title: "AI Fluency for Product Team Members™", group: "Self-paced courses", format: "Self-paced online", summary: "Using AI effectively and responsibly in everyday product work.", url: `${SO}/all-courses/self-paced/ai-fluency-product-team-members` },
];

export function partnerInfo(slug: string): PartnerInfo | undefined {
  return PARTNER_INFO.find((p) => p.slug === slug);
}

export function coursesFor(partner: PartnerSlug): PartnerCourse[] {
  return PARTNER_COURSES.filter((c) => c.partner === partner);
}

export function findCourse(partner: string, slug: string): PartnerCourse | undefined {
  return PARTNER_COURSES.find((c) => c.partner === partner && c.slug === slug);
}

// ---------------------------------------------------------------- PACA courses (coming soon)

export interface PacaCourse {
  title: string;
  category: string;
  summary: string;
}

export const PACA_COURSES: PacaCourse[] = [
  { title: "APK1", category: "Kanban", summary: "Part one of PACA's Kanban programme." },
  { title: "APK2", category: "Kanban", summary: "Part two of PACA's Kanban programme, building on APK1." },
  { title: "PSM Series", category: "Scrum Master", summary: "A series of Scrum Master courses, from first steps to advanced practice." },
  { title: "SAFe Courses", category: "Scaled Agile", summary: "Courses on the Scaled Agile Framework for teams of teams and enterprises." },
  { title: "Red Team Thinking", category: "Leadership", summary: "Critical thinking and decision-making techniques that challenge assumptions and plans." },
  { title: "Akaditi Courses", category: "Akaditi", summary: "Professional development courses delivered with Akaditi." },
  { title: "Mindset Training Courses", category: "Akaditi", summary: "Training on the Agile mindset, by Akaditi." },
  { title: "Introduction to Agile, Scrum and Kanban", category: "Akaditi", summary: "A beginner-friendly introduction to Agile, Scrum and Kanban, by Akaditi." },
];
