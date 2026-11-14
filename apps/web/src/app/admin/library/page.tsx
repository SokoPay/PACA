"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  deleteLibraryBook,
  fetchAdminLibrary,
  openLibraryBook,
  TIER_LABEL,
  updateLibraryBook,
  uploadLibraryBook,
  type AdminLibraryBook,
  type MembershipTierValue,
} from "@/lib/api";

const ALL_TIERS = Object.keys(TIER_LABEL) as MembershipTierValue[];
const MAX_MB = 50;

function TierPicker({ value, onChange }: { value: MembershipTierValue[]; onChange: (v: MembershipTierValue[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_TIERS.map((t) => {
        const on = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
            className="rounded-full border px-3 py-1 text-xs font-medium"
            style={{
              borderColor: on ? "var(--color-paca-500)" : "var(--border)",
              background: on ? "var(--color-paca-50)" : "transparent",
              color: on ? "var(--color-paca-700)" : "var(--text-muted)",
            }}
          >
            {TIER_LABEL[t]}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminLibraryPage() {
  const [books, setBooks] = useState<AdminLibraryBook[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tiers, setTiers] = useState<MembershipTierValue[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setBooks(await fetchAdminLibrary());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the library.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!file) return setError("Choose a PDF file.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Books must be ${MAX_MB}MB or smaller.`);
    setUploading(true);
    try {
      const book = await uploadLibraryBook({ title: title.trim(), description: description.trim(), tiers, file });
      setNotice(`“${book.title}” added and published.`);
      setTitle("");
      setDescription("");
      setTiers([]);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function patch(id: string, p: Parameters<typeof updateLibraryBook>[1]) {
    setError(null);
    try {
      const updated = await updateLibraryBook(id, p);
      setBooks((list) => list?.map((b) => (b.id === id ? updated : b)) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed.");
    }
  }

  async function remove(b: AdminLibraryBook) {
    if (!window.confirm(`Delete “${b.title}”? Members will lose access and the file is removed.`)) return;
    setError(null);
    try {
      await deleteLibraryBook(b.id);
      setBooks((list) => list?.filter((x) => x.id !== b.id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed.");
    }
  }

  const field = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500";
  const fieldStyle = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Member library</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        PDF books members read before their exam. Pick the membership types each book is for; leave all unselected to
        give it to every paid member. Only members with an active (paid) membership can open them.
      </p>

      <form
        onSubmit={onUpload}
        className="mt-6 max-w-2xl space-y-4 rounded-xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <h2 className="font-semibold">Add a book</h2>
        <div>
          <label htmlFor="book-title" className="mb-1 block text-sm font-medium">Title</label>
          <input id="book-title" required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className={field} style={fieldStyle} />
        </div>
        <div>
          <label htmlFor="book-desc" className="mb-1 block text-sm font-medium">
            Description <span style={{ color: "var(--text-muted)" }}>(optional)</span>
          </label>
          <textarea id="book-desc" rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={field} style={fieldStyle} />
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium">For membership types</span>
          <TierPicker value={tiers} onChange={setTiers} />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {tiers.length === 0 ? "None selected: every paid member can read it." : `Only ${tiers.map((t) => TIER_LABEL[t]).join(", ")} members.`}
          </p>
        </div>
        <div>
          <label htmlFor="book-file" className="mb-1 block text-sm font-medium">PDF file (max {MAX_MB}MB)</label>
          <input id="book-file" ref={fileRef} type="file" accept="application/pdf,.pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        {error && (
          <p role="alert" className="rounded-lg px-3 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>{error}</p>
        )}
        {notice && (
          <p role="status" className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--color-paca-50)", color: "var(--color-paca-800)" }}>{notice}</p>
        )}
        <button type="submit" disabled={uploading} className="rounded-lg bg-paca-500 px-5 py-2 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60">
          {uploading ? "Uploading…" : "Upload and publish"}
        </button>
      </form>

      <h2 className="mt-10 font-semibold">Books ({books?.length ?? 0})</h2>
      {books === null && !error && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {books?.length === 0 && <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No books yet.</p>}

      <div className="mt-3 space-y-3">
        {books?.map((b) => (
          <div key={b.id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{b.title}</div>
                <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  {b.fileName} · {b.fileSizeBytes ? `${(b.fileSizeBytes / 1024 / 1024).toFixed(1)} MB` : ""} · opened {b.downloadCount}×
                  · {b.status === "PUBLISHED" ? "Published" : "Hidden"}
                </div>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                <button onClick={() => void openLibraryBook(b.id).catch(() => setError("Could not open the file."))} className="text-paca-500 hover:underline">
                  View
                </button>
                <button onClick={() => void patch(b.id, { published: b.status !== "PUBLISHED" })} className="text-paca-500 hover:underline">
                  {b.status === "PUBLISHED" ? "Hide" : "Publish"}
                </button>
                <button onClick={() => void remove(b)} className="hover:underline" style={{ color: "#c0392b" }}>
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-3">
              <TierPicker value={b.tiers} onChange={(t) => void patch(b.id, { tiers: t })} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
