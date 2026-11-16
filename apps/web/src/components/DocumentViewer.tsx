"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  downloadDocument,
  fetchDocumentBlobUrl,
  fetchDocumentPreview,
  type ApplicationDocumentView,
  type DocumentScope,
} from "@/lib/api";

type Kind = "image" | "pdf" | "docx" | "doc" | "other";

function kindOf(doc: ApplicationDocumentView): Kind {
  const m = doc.mimeType ?? "";
  const name = doc.originalName.toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g)$/.test(name)) return "image";
  if (m === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (m.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
  if (m === "application/msword" || name.endsWith(".doc")) return "doc";
  return "other";
}

const ICON: Record<Kind, string> = { image: "🖼️", pdf: "📕", docx: "📝", doc: "📝", other: "📄" };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shows uploaded application documents on the page: images and PDFs inline,
 * Word (.docx) files as a readable preview. Files are fetched with the
 * viewer's own session, so the same component serves members and admins.
 */
export function DocumentViewer({
  scope,
  applicationId,
  documents,
  labels = {},
}: {
  scope: DocumentScope;
  applicationId: string;
  documents: ApplicationDocumentView[];
  /** Friendly names per document kind, e.g. { CV: "Current CV" }. */
  labels?: Record<string, string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id ?? null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = documents.find((d) => d.id === selectedId) ?? null;
  const kind = selected ? kindOf(selected) : "other";

  useEffect(() => {
    if (!documents.some((d) => d.id === selectedId)) setSelectedId(documents[0]?.id ?? null);
  }, [documents, selectedId]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    let url: string | null = null;
    setBlobUrl(null);
    setHtml(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        if (kind === "docx") {
          const r = await fetchDocumentPreview(scope, applicationId, selected.id);
          if (!cancelled) setHtml(r.html);
        } else if (kind === "image" || kind === "pdf") {
          url = await fetchDocumentBlobUrl(scope, applicationId, selected.id);
          if (!cancelled) setBlobUrl(url);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not open this file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [scope, applicationId, selected, kind]);

  if (documents.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        No documents uploaded.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      {/* file list */}
      <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {documents.map((d) => {
          const active = d.id === selectedId;
          return (
            <li key={d.id} className="shrink-0 lg:shrink">
              <button
                onClick={() => setSelectedId(d.id)}
                className="w-full rounded-xl border px-3 py-2.5 text-left text-sm transition"
                style={{
                  borderColor: active ? "var(--color-paca-500)" : "var(--border)",
                  background: active ? "var(--color-paca-50)" : "var(--bg)",
                }}
              >
                <div className="font-semibold">
                  {ICON[kindOf(d)]} {labels[d.kind] ?? (d.kind === "OTHER" ? "Other document" : d.kind.charAt(0) + d.kind.slice(1).replace(/_/g, " ").toLowerCase())}
                </div>
                <div className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }} title={d.originalName}>
                  {d.originalName} · {formatBytes(d.sizeBytes)}
                </div>
                {d.scanStatus === "INFECTED" && <div className="mt-0.5 text-xs font-semibold text-[#c0392b]">Failed virus scan</div>}
              </button>
            </li>
          );
        })}
      </ul>

      {/* viewer */}
      {selected && (
        <div className="min-w-0 overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
            <span className="truncate font-medium" title={selected.originalName}>
              {selected.originalName}
            </span>
            <div className="flex gap-2">
              {blobUrl && (
                <a href={blobUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-2.5 py-1 font-semibold hover:border-paca-500" style={{ borderColor: "var(--border)" }}>
                  Open full screen
                </a>
              )}
              <button
                onClick={() => void downloadDocument(scope, applicationId, selected).catch(() => setError("Could not download this file."))}
                className="rounded-lg bg-paca-500 px-2.5 py-1 font-semibold text-white hover:bg-paca-600"
              >
                Download
              </button>
            </div>
          </div>

          <div className="flex min-h-[420px] items-center justify-center" style={{ background: "#eef1f5" }}>
            {loading && <p className="text-sm" style={{ color: "#52606d" }}>Opening file…</p>}
            {error && <p className="px-4 text-sm text-[#c0392b]">{error}</p>}
            {!loading && !error && kind === "image" && blobUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={blobUrl} alt={selected.originalName} className="max-h-[70vh] max-w-full object-contain" />
            )}
            {!loading && !error && kind === "pdf" && blobUrl && (
              <iframe src={blobUrl} title={selected.originalName} className="h-[70vh] w-full border-0 bg-white" />
            )}
            {!loading && !error && kind === "docx" &&
              (html ? (
                // sandbox="" = no scripts, no forms, no navigation: the preview is display-only.
                <iframe srcDoc={html} sandbox="" title={selected.originalName} className="h-[70vh] w-full border-0 bg-white" />
              ) : (
                <NoPreview />
              ))}
            {!loading && !error && (kind === "doc" || kind === "other") && <NoPreview />}
          </div>
        </div>
      )}
    </div>
  );
}

function NoPreview() {
  return (
    <div className="max-w-sm px-6 text-center text-sm" style={{ color: "#52606d" }}>
      <div className="text-4xl">📝</div>
      <p className="mt-2 font-semibold">This is an older Word (.doc) file</p>
      <p className="mt-1">It cannot be shown on the page. Use Download to open it in Word.</p>
    </div>
  );
}
