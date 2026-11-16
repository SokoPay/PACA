/** Simple PACA-branded transactional email: heading, paragraphs, optional note box and button. */
export interface BrandedEmail {
  firstName: string;
  heading: string;
  paragraphs: string[];
  /** Highlighted box, e.g. the reviewer's reason for a decline. */
  note?: { label: string; text: string };
  cta?: { label: string; url: string };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function brandedEmail(e: BrandedEmail): { html: string; text: string } {
  const name = esc(e.firstName);
  const paras = e.paragraphs.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join("");
  const note = e.note
    ? `<div style="margin:6px 0 18px;padding:14px 16px;border-left:4px solid #0060cc;background:#eef5ff;border-radius:6px">
<div style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#0060cc">${esc(e.note.label)}</div>
<div style="margin-top:6px;white-space:pre-wrap">${esc(e.note.text)}</div></div>`
    : "";
  const cta = e.cta
    ? `<p style="margin:22px 0 6px"><a href="${esc(e.cta.url)}" style="display:inline-block;background:#0060cc;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">${esc(e.cta.label)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:540px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#001b44,#0060cc);padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:2px">PACA <span style="font-size:12px;font-weight:normal;letter-spacing:0;opacity:.85">Professional Agile Certification · Africa</span></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.55">
<p style="margin:0 0 14px">Hello ${name},</p>
<h1 style="margin:0 0 14px;font-size:20px;color:#0b1b33">${esc(e.heading)}</h1>
${paras}${note}${cta}
<p style="margin:22px 0 0;font-size:13px;color:#52606d">— The PACA team</p>
</td></tr></table></td></tr></table></body></html>`;

  const text = [
    `Hello ${e.firstName},`,
    "",
    e.heading,
    "",
    ...e.paragraphs.flatMap((p) => [p, ""]),
    ...(e.note ? [`${e.note.label}:`, e.note.text, ""] : []),
    ...(e.cta ? [`${e.cta.label}: ${e.cta.url}`, ""] : []),
    "— The PACA team",
  ].join("\n");

  return { html, text };
}
