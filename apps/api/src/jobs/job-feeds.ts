/**
 * Job feed adapters. Each returns normalised postings; the crawler filters and
 * classifies them. Only public APIs meant for reuse are used:
 *
 *  - Jobicy        — remote jobs API; requires crediting Jobicy and linking to the original job.
 *  - Arbeitnow     — free job-board API.
 *  - Greenhouse    — a company's public job board (boards-api.greenhouse.io), by board token.
 *  - Lever         — a company's public postings API (api.lever.co), by company handle.
 *
 * Remotive is deliberately absent: its terms forbid showing its jobs behind a signup or paywall.
 */

export interface RawJob {
  externalId: string;
  title: string;
  company: string;
  companyLogoUrl?: string | null;
  location?: string | null;
  isRemote: boolean;
  employmentType?: string | null;
  description: string; // plain text
  applyUrl: string;
  postedAt?: Date | null;
}

const UA = "PACA-jobs/1.0 (+https://pac-a.org)";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return (await res.json()) as T;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&hellip;": "…" };

export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html;
  // Some feeds double-escape their HTML.
  for (let i = 0; i < 2 && /&lt;\w/.test(s); i++) s = s.replace(/&(amp|lt|gt|quot|#39|nbsp|hellip);/g, (m) => ENTITIES[m] ?? m);
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp|hellip);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return s.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function date(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchJobicy(config: { tags?: string[] }): Promise<RawJob[]> {
  const tags = config.tags?.length ? config.tags : ["agile", "scrum", "product owner", "kanban", "agile coach"];
  const out = new Map<string, RawJob>();
  for (const tag of tags) {
    const data = await getJson<{ jobs?: Array<Record<string, unknown>> }>(
      `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag)}`,
    );
    for (const j of data.jobs ?? []) {
      const id = String(j.id ?? "");
      if (!id || out.has(id)) continue;
      out.set(id, {
        externalId: id,
        title: String(j.jobTitle ?? "").trim(),
        company: String(j.companyName ?? "Unknown"),
        companyLogoUrl: (j.companyLogo as string) ?? null,
        location: (j.jobGeo as string) ?? "Remote",
        isRemote: true,
        employmentType: Array.isArray(j.jobType) ? (j.jobType as string[]).join(", ") : null,
        description: htmlToText((j.jobDescription as string) ?? (j.jobExcerpt as string)),
        applyUrl: String(j.url ?? ""),
        postedAt: date(j.pubDate),
      });
    }
  }
  return [...out.values()];
}

export async function fetchArbeitnow(config: { pages?: number }): Promise<RawJob[]> {
  const pages = Math.min(Math.max(config.pages ?? 3, 1), 5);
  const out: RawJob[] = [];
  for (let page = 1; page <= pages; page++) {
    const data = await getJson<{ data?: Array<Record<string, unknown>> }>(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    for (const j of data.data ?? []) {
      out.push({
        externalId: String(j.slug ?? ""),
        title: String(j.title ?? "").trim(),
        company: String(j.company_name ?? "Unknown"),
        location: (j.location as string) ?? null,
        isRemote: Boolean(j.remote),
        employmentType: Array.isArray(j.job_types) ? (j.job_types as string[]).join(", ") : null,
        description: htmlToText(j.description as string),
        applyUrl: String(j.url ?? ""),
        postedAt: date(j.created_at),
      });
    }
    if (!data.data?.length) break;
  }
  return out.filter((j) => j.externalId && j.applyUrl);
}

export async function fetchGreenhouse(config: { boardToken?: string; company?: string }): Promise<RawJob[]> {
  if (!config.boardToken) throw new Error("Greenhouse source needs a board token");
  const data = await getJson<{ jobs?: Array<Record<string, unknown>> }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(config.boardToken)}/jobs?content=true`,
  );
  return (data.jobs ?? []).map((j) => {
    const location = (j.location as { name?: string } | undefined)?.name ?? null;
    return {
      externalId: String(j.id),
      title: String(j.title ?? "").trim(),
      company: config.company ?? config.boardToken!,
      location,
      isRemote: /remote/i.test(location ?? ""),
      description: htmlToText(j.content as string),
      applyUrl: String(j.absolute_url ?? ""),
      postedAt: date(j.updated_at),
    };
  });
}

export async function fetchLever(config: { company?: string; companyName?: string }): Promise<RawJob[]> {
  if (!config.company) throw new Error("Lever source needs a company handle");
  const data = await getJson<Array<Record<string, unknown>>>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(config.company)}?mode=json`,
  );
  return data.map((j) => {
    const cat = (j.categories as { location?: string; commitment?: string } | undefined) ?? {};
    return {
      externalId: String(j.id),
      title: String(j.text ?? "").trim(),
      company: config.companyName ?? config.company!,
      location: cat.location ?? null,
      isRemote: /remote/i.test(cat.location ?? "") || j.workplaceType === "remote",
      employmentType: cat.commitment ?? null,
      description: String(j.descriptionPlain ?? ""),
      applyUrl: String(j.hostedUrl ?? ""),
      postedAt: date(j.createdAt),
    };
  });
}

/**
 * Cheap first pass on the title, so only plausibly-Agile jobs reach the AI
 * classifier (or, without an API key, the heuristic one).
 */
export const AGILE_TITLE =
  /\b(agile|scrum|kanban|product owner|product manager|delivery (manager|lead)|release train|\bRTE\b|agile coach|business analyst|iteration manager|program(me)? manager|project manager|SAFe|lean)\b/i;
