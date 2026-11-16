"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  deleteUser,
  fetchUsers,
  restoreSession,
  setUserRole,
  setUserStatus,
  type AdminRole,
  type AdminUserListItem,
  type AdminUserStatus,
  type SessionUser,
} from "@/lib/api";
import { UserProfileModal } from "./UserProfileModal";

const ROLES: AdminRole[] = ["MEMBER", "REVIEWER", "ADMIN", "SUPERADMIN"];
const STATUSES: AdminUserStatus[] = ["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED"];
const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const router = useRouter();

  const [me, setMe] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "">("");
  const [statusFilter, setStatusFilter] = useState<AdminUserStatus | "">("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminUserListItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // ---------------------------------------------------------------- session
  useEffect(() => {
    restoreSession().then((session) => {
      if (!session || session.role === "MEMBER" || session.role === "REVIEWER") {
        // GET /admin/users requires ADMIN+ on the server; a REVIEWER would just
        // bounce off 403s, so send them somewhere that actually works for them.
        router.replace(session ? "/admin/queue" : "/login");
        return;
      }
      setMe(session);
      setChecking(false);
    });
  }, [router]);

  // ---------------------------------------------------------------- data
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUsers({
        query: query || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [query, roleFilter, statusFilter, page]);

  useEffect(() => {
    if (!checking && me) void load();
  }, [checking, me, load]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  async function changeRole(user: AdminUserListItem, role: AdminRole) {
    if (role === user.role) return;
    setBusyId(user.id);
    setError(null);
    try {
      const updated = await setUserRole(user.id, role);
      setItems((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      flash(`${user.email} is now ${role}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change role.");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(user: AdminUserListItem) {
    const next = user.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    setBusyId(user.id);
    setError(null);
    try {
      const updated = await setUserStatus(user.id, next);
      setItems((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      flash(next === "SUSPENDED" ? `${user.email} suspended` : `${user.email} reactivated`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change status.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    setError(null);
    try {
      await deleteUser(deleting.id);
      setItems((prev) => prev.filter((u) => u.id !== deleting.id));
      setTotal((t) => Math.max(0, t - 1));
      flash(`${deleting.email} permanently deleted`);
      setDeleting(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete user.");
    } finally {
      setBusyId(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canEditRoles = me?.role === "SUPERADMIN";

  if (checking) {
    return (
      <main className="flex h-full items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full max-w-[1400px] flex-col">
      {/* ---------------------------------------------------------- header */}
      <header
        className="flex shrink-0 flex-wrap items-center gap-6 border-b px-6 py-3"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h1 className="text-sm font-semibold">Users</h1>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {total} user{total === 1 ? "" : "s"}
        </span>
      </header>

      {/* ---------------------------------------------------------- filters */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-2 text-xs"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <input
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          placeholder="Search name or email…"
          className="w-56 rounded border px-2 py-1"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value as AdminRole | "");
          }}
          className="rounded border px-2 py-1"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as AdminUserStatus | "");
          }}
          className="rounded border px-2 py-1"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {loading && <span style={{ color: "var(--text-muted)" }}>Loading…</span>}
      </div>

      {error && (
        <div role="alert" className="shrink-0 px-6 py-2 text-sm" style={{ background: "#c0392b1a", color: "#c0392b" }}>
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline underline-offset-2">
            dismiss
          </button>
        </div>
      )}

      {!canEditRoles && (
        <p className="shrink-0 px-6 pt-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Only a SUPERADMIN can change roles. You can still suspend or reactivate accounts.
        </p>
      )}

      {/* ---------------------------------------------------------- table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Joined</th>
              <th className="py-2 pr-3">Last login</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const isSelf = u.id === me?.id;
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                  <td className="py-2 pr-3">
                    <button onClick={() => setViewingId(u.id)} className="text-left font-semibold text-paca-500 hover:underline">
                      {u.firstName} {u.lastName}
                    </button>
                    {isSelf && <span style={{ color: "var(--text-muted)" }}> (you)</span>}
                  </td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">
                    {canEditRoles ? (
                      <select
                        value={u.role}
                        disabled={isSelf || busy}
                        onChange={(e) => void changeRole(u, e.target.value as AdminRole)}
                        className="rounded border px-2 py-1 text-xs"
                        style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      u.role
                    )}
                  </td>
                  <td className="py-2 pr-3">{u.status}</td>
                  <td className="py-2 pr-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-3">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setViewingId(u.id)}
                        className="rounded border px-2 py-1 text-xs font-semibold text-paca-500"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {canEditRoles ? "View / edit" : "View"}
                      </button>
                      {u.status !== "DELETED" && (
                        <button
                          disabled={isSelf || busy}
                          onClick={() => void toggleStatus(u)}
                          className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                          style={{
                            borderColor: "var(--border)",
                            color: u.status === "SUSPENDED" ? "var(--paca-500)" : "#c0392b",
                          }}
                        >
                          {u.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                        </button>
                      )}
                      {canEditRoles && u.status !== "DELETED" && (
                        <button
                          disabled={isSelf || busy}
                          onClick={() => setDeleting(u)}
                          className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                          style={{ borderColor: "#c0392b", color: "#c0392b" }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>
                  No users match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------------------------------------------------- pagination */}
      <div
        className="flex shrink-0 items-center justify-end gap-3 border-t px-6 py-2 text-xs"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="underline underline-offset-2 disabled:opacity-40">
          Previous
        </button>
        <span>
          Page {page} of {pageCount}
        </span>
        <button
          disabled={page >= pageCount}
          onClick={() => setPage((p) => p + 1)}
          className="underline underline-offset-2 disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* ---------------------------------------------------------- delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl border p-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h2 className="text-sm font-semibold">Permanently delete this account?</h2>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {deleting.firstName} {deleting.lastName} ({deleting.email}) and everything that belongs to
              them — profile, applications and uploaded documents, membership, payments, exam attempts,
              certificates and notifications — will be permanently erased. This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2 text-sm">
              <button onClick={() => setDeleting(null)} className="rounded-lg px-3 py-1.5" style={{ color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={busyId === deleting.id}
                className="rounded-lg px-3 py-1.5 font-semibold text-white disabled:opacity-50"
                style={{ background: "#c0392b" }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingId && (
        <UserProfileModal
          userId={viewingId}
          canEdit={canEditRoles}
          onClose={() => setViewingId(null)}
          onSaved={(message) => {
            flash(message);
            void load();
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white"
          style={{ background: "#146b2e" }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
