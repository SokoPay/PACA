"use client";

import { useState } from "react";

/**
 * Share a public PACA page (badge, certificate, test score) on social media.
 * Every network reads the page's preview image and title from its Open Graph tags.
 */
export function ShareButtons({ url, text, compact = false }: { url: string; text: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);

  const links: Array<{ name: string; href: string; bg: string; icon: React.ReactNode }> = [
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      bg: "#0a66c2",
      icon: <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.84-2.05 3.8-2.05C20.6 8.65 21 11.2 21 14.5V21h-4v-5.8c0-1.4 0-3.2-1.95-3.2s-2.25 1.5-2.25 3.1V21H9z" />,
    },
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
      bg: "#111111",
      icon: <path d="M17.7 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.5 4.7H5.7z" />,
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      bg: "#1877f2",
      icon: <path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.1L14 2c-3.3 0-4 2.4-4 4v2.5H8V12h2v10h4V12h2.7l.4-3.5z" />,
    },
    {
      name: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      bg: "#25d366",
      icon: <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11.6 11.6 0 0 1-4.6-4.1c-.3-.5-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.2.2-.3.3-.1.6.2.4.9 1.4 1.9 2.3 1.3 1.1 2.3 1.4 2.7 1.6.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.7-.1 1.2z" />,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Share on ${l.name}`}
          className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          style={{ background: l.bg }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            {l.icon}
          </svg>
          {!compact && l.name}
        </a>
      ))}
      <button
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ title: text, url });
            else {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          } catch {
            // dismissed / blocked
          }
        }}
        className="inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition hover:border-paca-500 hover:text-paca-500"
        style={{ borderColor: "var(--border)" }}
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
    </div>
  );
}

/** "Add to profile" link that pre-fills a LinkedIn certification entry. */
export function addToLinkedInUrl(opts: { name: string; certUrl: string; certId?: string; issued?: Date }): string {
  const p = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: opts.name,
    organizationName: "Professional Agile Certification Africa (PACA)",
    certUrl: opts.certUrl,
  });
  if (opts.certId) p.set("certId", opts.certId);
  if (opts.issued) {
    p.set("issueYear", String(opts.issued.getFullYear()));
    p.set("issueMonth", String(opts.issued.getMonth() + 1));
  }
  return `https://www.linkedin.com/profile/add?${p}`;
}
