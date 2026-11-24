/**
 * Legal document drafts.
 *
 * IMPORTANT: these are drafts written from the system's actual data flows, not
 * legal advice. They must be reviewed by a qualified lawyer before launch —
 * particularly the Terms, which govern membership revocation and certification
 * withdrawal for a body that issues professional credentials.
 *
 * They are kept here as seed content. Once reviewed, they should be loaded into
 * the `LegalDocument` table (immutable, versioned) so that member consent is
 * recorded against a specific version — see UserConsent in the schema.
 */

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  summary: string;
  effectiveFrom: string;
  sections: LegalSection[];
}

const CONTROLLER =
  "Professional Agile Certification — Africa (PACA) is the data controller for the personal data described in this notice.";

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What personal data PACA collects, why, and what rights you have over it.",
    effectiveFrom: "2026-09-08",
    sections: [
      {
        heading: "Who we are",
        paragraphs: [
          CONTROLLER,
          "We process personal data under Ghana's Data Protection Act, 2012 (Act 843) and, where members are located in the European Economic Area or the United Kingdom, the General Data Protection Regulation.",
        ],
      },
      {
        heading: "What we collect",
        paragraphs: ["The data we hold depends on how far you go through the membership process."],
        bullets: [
          "Account details: your name, email address, phone number and password (stored only as an argon2id hash — we never hold your password itself).",
          "Application details: postal address, country, gender if you choose to state it, educational qualifications, year of graduation, occupation and employer.",
          "Supporting documents: your CV, professional or educational certificates, student ID, recommendation letter or evidence of retirement, depending on the membership type you apply for.",
          "Referee details: the names and email addresses of the referees you nominate.",
          "Assessment records: the questions served to you, the answers you gave, your score and the outcome of each attempt.",
          "Technical data: IP address, browser user agent and timestamps, recorded against sign-ins and significant actions for security and audit purposes.",
        ],
      },
      {
        heading: "Why we process it",
        paragraphs: ["Each purpose has a lawful basis:"],
        bullets: [
          "To assess your membership application and administer your membership — necessary for the performance of our contract with you.",
          "To deliver and invigilate assessments and issue certificates — necessary for the performance of our contract with you.",
          "To publish your name, membership type and credential status on our public verification page — necessary for our legitimate interest in maintaining a credible, checkable register of certified practitioners.",
          "To send you service messages about your application, payments and certificates — necessary for the performance of our contract.",
          "To send you marketing about courses, events and partner offers — only with your separate, freely-given consent, which you may withdraw at any time.",
          "To detect and investigate misconduct in assessments — necessary for our legitimate interest in protecting the integrity of the credential.",
        ],
      },
      {
        heading: "Public information",
        paragraphs: [
          "Certificates issued by PACA carry a credential identifier that can be checked on a public verification page. That page shows the holder's name, membership type, issue date and current status. This is deliberate: a certificate nobody can verify is worth little.",
          "Your inclusion in the public professional directory is optional and off by default. You can switch it on or off from your profile at any time.",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Account and membership records are kept for as long as you hold a membership and for six years afterwards, so that we can answer questions about credentials we have issued.",
          "Supporting documents such as CVs and identity documents are kept for the duration of the application process and for twelve months after a decision, then deleted.",
          "Assessment attempt records, including the questions served and answers given, are kept for six years so that a disputed result can be investigated.",
          "Audit logs are kept for six years.",
        ],
      },
      {
        heading: "Who we share it with",
        paragraphs: [
          "We share personal data only where necessary to run the service: with our payment provider to process subscription payments, with our email provider to send you service messages and certificates, and with our hosting and infrastructure providers.",
          "We do not sell personal data, and we do not share it with partner training providers unless you ask us to.",
        ],
      },
      {
        heading: "International transfers",
        paragraphs: [
          "There is currently no major cloud region located in Ghana. Our infrastructure is hosted in an African region where available, and your data may therefore be processed outside Ghana. Where data leaves Ghana or the EEA, we rely on appropriate safeguards including standard contractual clauses.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You may ask us to give you a copy of your data, correct it, delete it, restrict how we use it, or object to processing based on legitimate interests. You may withdraw marketing consent at any time without affecting your membership.",
          "You can raise a request from your account, and we will respond within the statutory time limit. If you are unhappy with how we handle it, you may complain to Ghana's Data Protection Commission or, if you are in the EEA or UK, your local supervisory authority.",
          "Deleting your account does not remove the public record of a credential we have already issued, since third parties rely on it. We will, however, remove the personal data that is not needed to support that record.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "Passwords are hashed with argon2id. Uploaded documents are stored in private object storage and served only through short-lived signed links. Access to member data is restricted by role, administrator accounts require two-factor authentication, and privileged actions are recorded in an append-only audit log.",
        ],
      },
    ],
  },

  terms: {
    slug: "terms",
    title: "Terms & Conditions",
    summary: "The terms on which PACA provides membership, assessments and certification.",
    effectiveFrom: "2026-09-08",
    sections: [
      {
        heading: "Membership",
        paragraphs: [
          "Registering for an account is free. Membership begins only when an application has been approved by the Board and the applicable subscription fee has been paid in full.",
          "The Board considers every application impartially and without regard to race, gender or language. The Board's decision on an application is final.",
          "Subscriptions run annually and fall due on 1 January. A member whose subscription is unpaid may not exercise the rights of membership or represent themselves as holding a current PACA certification until payment is made.",
        ],
      },
      {
        heading: "Fees",
        paragraphs: [
          "Fees are set by the Board and may change from time to time. The fee applicable to you is the one displayed at the time you pay.",
          "You may register and pay later. Your certificate, member badge and other membership benefits remain locked until payment clears.",
          "Fees are stated in United States dollars. Where you pay in another currency, the amount charged is converted by our payment provider at their prevailing rate.",
        ],
      },
      {
        heading: "Assessments",
        paragraphs: [
          "Paid members may sit the certification assessment for their membership type. Each subscription includes a fixed number of attempts, shown on the membership page for that type. If you do not pass within those attempts, you may purchase a further block of attempts.",
          "Assessments are timed and must be completed in a single sitting. Questions are drawn at random and are not repeated to the same candidate within a day.",
          "Results are calculated automatically and shown immediately. To protect the integrity of the question bank, candidates who do not pass are shown their score and a breakdown by topic, but not the individual questions or answers.",
        ],
      },
      {
        heading: "Conduct and misconduct",
        paragraphs: [
          "You agree to sit assessments personally and without assistance, and not to record, reproduce, share or publish assessment questions in any form.",
          "Where PACA determines that misconduct has occurred, it may void the affected attempt, revoke any certificate issued in reliance on it, and suspend or terminate membership. Any such determination will be notified to you with reasons, and you may make representations before it becomes final.",
        ],
      },
      {
        heading: "Certificates and badges",
        paragraphs: [
          "A certificate records that you passed a specific assessment on a specific date. It remains a matter of record permanently.",
          "The validity of a certificate is tied to your membership standing. If your subscription lapses, the certificate is marked as suspended on the public verification page and you may not represent yourself as currently certified until you renew. Renewing restores it.",
          "Member badges may be displayed on professional networks and personal sites provided they are not altered and are not used in a way that suggests PACA endorses a product, employer or service.",
        ],
      },
      {
        heading: "Intellectual property",
        paragraphs: [
          "The PACA name, logo, badges, assessment questions and learning materials remain the property of PACA. Membership grants you a personal, non-transferable right to use your certificate and badge to describe your own qualifications, and nothing further.",
        ],
      },
      {
        heading: "Liability",
        paragraphs: [
          "PACA provides certification and educational services. We do not guarantee any particular employment, commercial or professional outcome from holding a PACA credential.",
          "Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for any liability that cannot lawfully be excluded.",
        ],
      },
      {
        heading: "Changes and governing law",
        paragraphs: [
          "We may amend these terms. Where a change is material, we will notify you and ask you to accept the revised terms before you continue to use the service. The version you accepted, and the date you accepted it, are recorded.",
          "These terms are governed by the laws of Ghana, and the courts of Ghana have exclusive jurisdiction.",
        ],
      },
    ],
  },

  "data-protection": {
    slug: "data-protection",
    title: "Data Protection Policy",
    summary: "How PACA protects personal data and meets its obligations as a data controller.",
    effectiveFrom: "2026-09-08",
    sections: [
      {
        heading: "Scope and accountability",
        paragraphs: [
          CONTROLLER,
          "This policy applies to everyone who processes personal data on PACA's behalf, including board members, staff, reviewers and contractors.",
        ],
      },
      {
        heading: "Principles we apply",
        paragraphs: ["Personal data held by PACA is:"],
        bullets: [
          "Processed lawfully, fairly and transparently.",
          "Collected only for the specified purposes set out in our Privacy Policy.",
          "Limited to what is necessary — we do not ask for documents a membership type does not require.",
          "Kept accurate and up to date, with a route for members to correct it themselves.",
          "Retained no longer than the periods published in our Privacy Policy.",
          "Protected by appropriate technical and organisational measures.",
        ],
      },
      {
        heading: "Sensitive documents",
        paragraphs: [
          "Membership applications require identity and qualification documents. These are treated as the highest-risk data we hold.",
          "They are stored in private object storage that is never publicly addressable, retrieved only through short-lived signed links, scanned for malware on upload, and visible only to reviewers handling that application.",
        ],
      },
      {
        heading: "Access control",
        paragraphs: [
          "Access follows least privilege. Reviewers see only what an application requires. Administrator accounts must use two-factor authentication. Every privileged action — approving an application, publishing a question, granting an additional assessment attempt — is written to an append-only audit log recording who did it, when, and from where.",
        ],
      },
      {
        heading: "Data subject requests",
        paragraphs: [
          "Requests for access, correction, deletion or restriction are logged as tracked work items with a statutory deadline recorded at the point of creation, so that overdue requests are visible rather than forgotten in an inbox.",
        ],
      },
      {
        heading: "Breach response",
        paragraphs: [
          "Suspected breaches must be reported internally without delay. Where a breach is likely to result in a risk to the rights and freedoms of individuals, we will notify the Data Protection Commission within 72 hours of becoming aware of it, and notify affected members where the risk is high.",
        ],
      },
    ],
  },

  "data-usage": {
    slug: "data-usage",
    title: "Data Usage Policy",
    summary: "How PACA uses member data, including assessment records and automated processing.",
    effectiveFrom: "2026-09-08",
    sections: [
      {
        heading: "Purpose of this policy",
        paragraphs: [
          "Our Privacy Policy explains what we collect. This policy explains what we actually do with it, including where automated processing is involved.",
        ],
      },
      {
        heading: "Assessment data",
        paragraphs: [
          "When you sit an assessment we record the exact questions served to you, the order they were presented in, the answers you selected and the time taken.",
          "We keep this detail for one reason: if a result is ever disputed, we can reconstruct precisely what you were asked and how it was marked. Marking is fully automated and no member of staff intervenes in it.",
          "We also use aggregated, de-identified statistics — how often a question is answered correctly across all candidates — to identify and retire questions that are ambiguous or misleading. This analysis never identifies individual candidates.",
        ],
      },
      {
        heading: "Automated decision-making",
        paragraphs: [
          "Assessment results are produced automatically by comparing your answers with the stored answer key. Whether you pass is determined solely by your score against the published pass mark.",
          "Membership applications are not decided automatically. Every application is reviewed by a person, and Fellowship applications are assessed by a panel.",
          "If you believe a result is wrong, you may ask us to review it. We will re-examine the recorded attempt and explain the outcome.",
        ],
      },
      {
        heading: "Artificial intelligence",
        paragraphs: [
          "We use AI systems to help draft candidate assessment questions and to screen them for errors before a human reviewer sees them. No question reaches a live assessment without being approved by a qualified human reviewer.",
          "We also use AI to classify and categorise job listings gathered from public sources for our jobs board.",
          "We do not use AI to decide membership applications, and we do not send your personal data, application documents or assessment answers to third-party AI systems.",
        ],
      },
      {
        heading: "Marketing",
        paragraphs: [
          "We send marketing only to members who have separately opted in. Opting in is never a condition of membership and is never bundled into acceptance of our Terms. Every marketing message includes a one-click unsubscribe.",
        ],
      },
      {
        heading: "Partner organisations",
        paragraphs: [
          "Where a partner honours a PACA discount code in their own checkout, they can ask us only whether a given code is valid and whether its holder is a member in good standing. We do not disclose your name, contact details or assessment history to partners.",
        ],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Cookie policy",
    summary: "Which cookies and similar storage PACA uses, why, and how to change your choice.",
    effectiveFrom: "2026-11-24",
    sections: [
      {
        heading: "Your choice",
        paragraphs: [
          "When you first visit PACA we ask whether you accept analytics cookies. Essential storage is always on because the site cannot work without it. Analytics stays off unless you accept it, and you can change your choice at any time with “Cookie settings” at the bottom of every page.",
        ],
      },
      {
        heading: "Essential (always on)",
        paragraphs: ["These keep you signed in securely and remember basic preferences. They are never used for advertising."],
        bullets: [
          "paca_rt: a secure, httpOnly cookie that keeps you signed in (30 days, or until you sign out or are inactive for 30 minutes).",
          "paca.session, paca.lastActive: browser storage that lets open tabs know you are signed in and handles automatic sign-out after inactivity.",
          "paca.consent: remembers your cookie choice.",
          "Paystack sets its own cookies inside its secure payment window when you pay; see Paystack's privacy policy.",
        ],
      },
      {
        heading: "Analytics (only with your consent)",
        paragraphs: [
          "If you accept, we use Google Analytics 4 to understand which pages are visited and how people move through the site, so we can improve it. Google Analytics sets cookies named _ga and _ga_<id> that last up to two years. IP addresses are not stored by Google Analytics 4. We do not use advertising or remarketing cookies.",
        ],
      },
      {
        heading: "Changing your mind",
        paragraphs: [
          "Choose “Cookie settings” in the footer and select “Essential only”. Analytics stops immediately; you can also delete existing cookies in your browser settings.",
        ],
      },
    ],
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS);
