import type { TierFormDef } from "@/lib/api";

/** Displays an application's answers grouped by form section, with the form's own labels. */
export function ApplicationAnswers({ form, answers }: { form: TierFormDef; answers: Record<string, unknown> }) {
  const known = new Set(form.sections.flatMap((s) => s.fields.map((f) => f.name)));
  const extra = Object.entries(answers).filter(([k]) => !known.has(k));

  const show = (v: unknown, options?: Array<{ value: string; label: string }>) => {
    if (v === undefined || v === null || v === "") return <span style={{ color: "var(--text-muted)" }}>—</span>;
    const s = String(v);
    const label = options?.find((o) => o.value === s)?.label ?? s;
    return /^https?:\/\//.test(s) ? (
      <a href={s} target="_blank" rel="noreferrer" className="break-all text-paca-500 hover:underline">
        {s}
      </a>
    ) : (
      <span className="whitespace-pre-wrap break-words">{label}</span>
    );
  };

  return (
    <div className="space-y-5">
      {form.sections.map((section) => (
        <section key={section.title}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-paca-500">{section.title}</h4>
          <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {section.fields.map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {f.label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium">{show(answers[f.name], f.options)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {extra.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-paca-500">Other details</h4>
          <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {extra.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs" style={{ color: "var(--text-muted)" }}>{k}</dt>
                <dd className="mt-0.5 text-sm font-medium">{show(v)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}

/** Kind → friendly label, from the form's document list. */
export function documentLabels(form: TierFormDef): Record<string, string> {
  return Object.fromEntries(form.documents.map((d) => [d.kind, d.label]));
}

export const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: "Draft — not submitted", bg: "#eef1f5", fg: "#52606d" },
  SUBMITTED: { label: "Submitted — awaiting review", bg: "#e6f1ff", fg: "#0060cc" },
  UNDER_REVIEW: { label: "Under review", bg: "#e6f1ff", fg: "#0060cc" },
  APPROVED: { label: "Approved", bg: "#d4f5e2", fg: "#146c3b" },
  DECLINED: { label: "Changes needed", bg: "#fde2e2", fg: "#b42318" },
  WITHDRAWN: { label: "Withdrawn", bg: "#eef1f5", fg: "#52606d" },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, bg: "#eef1f5", fg: "#52606d" };
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}
