/**
 * API client.
 *
 * Token handling: the access token lives in memory only. The refresh token goes to
 * sessionStorage — not localStorage — so it dies with the tab and is not shared
 * across windows.
 *
 * This is a deliberate interim position. The correct end state is the refresh token
 * in an httpOnly, SameSite=Strict cookie so JavaScript cannot read it at all; that
 * needs the API to set cookies, which is a change to the auth controller. Until
 * then, any XSS in this admin UI could exfiltrate a session.
 */

/**
 * In the browser this is NEXT_PUBLIC_API_URL (inlined at build time — "/api/v1"
 * when the API sits behind the same reverse proxy as the site). Server components
 * cannot fetch a relative URL, so on the server INTERNAL_API_URL takes precedence:
 * the address the Next process itself can reach the API on.
 */
const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100/api/v1";
const API_URL =
  typeof window === "undefined" ? (process.env.INTERNAL_API_URL ?? PUBLIC_API_URL) : PUBLIC_API_URL;
const REFRESH_KEY = "paca.refresh";

let accessToken: string | null = null;

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "MEMBER" | "REVIEWER" | "ADMIN" | "SUPERADMIN";
  status: string;
  emailVerifiedAt?: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(status: number, message: string, fieldErrors: Array<{ field: string; message: string }> = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// The refresh token lives in localStorage so a member stays signed in across
// pages, tabs and browser restarts until they sign out (or it expires, 30 days).
function setRefreshToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(REFRESH_KEY); // pre-localStorage location
  } catch {
    // Private browsing or blocked storage — the session simply won't survive reload.
  }
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY) ?? sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- shared session state
// One signed-in user for the whole app, so the site header, dashboard and every
// other page agree on who is logged in. `undefined` = not checked yet.

let currentUser: SessionUser | null | undefined;
const listeners = new Set<(u: SessionUser | null | undefined) => void>();

function setCurrentUser(user: SessionUser | null): void {
  currentUser = user;
  for (const fn of listeners) fn(user);
}

export function getCurrentUser(): SessionUser | null | undefined {
  return currentUser;
}

export function subscribeSession(fn: (u: SessionUser | null | undefined) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Merge fields into the signed-in user (e.g. after verifying the email address). */
export function patchCurrentUser(patch: Partial<SessionUser>): void {
  if (currentUser) setCurrentUser({ ...currentUser, ...patch });
}

if (typeof window !== "undefined") {
  // Signing out in one tab signs out the others.
  window.addEventListener("storage", (e) => {
    if (e.key === REFRESH_KEY && !e.newValue) {
      accessToken = null;
      setCurrentUser(null);
    }
  });
}

export function hasSession(): boolean {
  return Boolean(accessToken || getRefreshToken());
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let fields: Array<{ field: string; message: string }> = [];
  try {
    const body = await res.json();
    if (typeof body?.message === "string") message = body.message;
    if (Array.isArray(body?.errors)) fields = body.errors;
  } catch {
    // non-JSON error body
  }
  return new ApiError(res.status, message, fields);
}

async function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  // FormData must NOT get a manual content-type — the browser sets its own
  // multipart boundary, and overriding it here would break the upload.
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Refresh once on 401, then retry. A second failure means the session is gone.
 *
 * Single-flight: a page that fires several requests at once gets several 401s
 * together. Refresh tokens are single-use, so letting each of them rotate the
 * same token would trip the API's reuse detection and revoke the whole session.
 */
function refreshSession(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(retried = false): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    // Another tab may have rotated the shared token a moment ago — use its successor.
    const latest = getRefreshToken();
    if (!retried && latest && latest !== refreshToken) return doRefresh(true);
    accessToken = null;
    if (res.status === 401) setRefreshToken(null);
    setCurrentUser(null);
    return false;
  }

  const data = await res.json();
  accessToken = data.accessToken;
  setRefreshToken(data.refreshToken);
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, init);

  if (res.status === 401 && getRefreshToken()) {
    if (await refreshSession()) res = await rawFetch(path, init);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Emails a reset link if the address has an account. Same answer either way. */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/password-reset/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await parseError(res);
}

export async function checkPasswordReset(token: string): Promise<{ valid: boolean; email?: string }> {
  const res = await fetch(`${API_URL}/auth/password-reset/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) return { valid: false };
  return res.json();
}

export async function resetPassword(token: string, password: string): Promise<{ email: string }> {
  const res = await fetch(`${API_URL}/auth/password-reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw await parseError(res);

  const data = await res.json();
  accessToken = data.accessToken;
  setRefreshToken(data.refreshToken);
  setCurrentUser(data.user as SessionUser);
  return data.user as SessionUser;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  accessToken = null;
  setRefreshToken(null);
  setCurrentUser(null);
  if (!refreshToken) return;
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Local session is already cleared; a failed server call is not worth blocking on.
  }
}

let restoreInFlight: Promise<SessionUser | null> | null = null;

/**
 * The signed-in user, or null. Cheap to call from every page: once the session is
 * known it is returned from memory, and concurrent callers share one request.
 */
export function restoreSession(): Promise<SessionUser | null> {
  if (currentUser && accessToken) return Promise.resolve(currentUser);
  restoreInFlight ??= doRestore().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

async function doRestore(): Promise<SessionUser | null> {
  if (!accessToken) {
    if (!getRefreshToken()) {
      setCurrentUser(null);
      return null;
    }
    if (!(await refreshSession())) {
      setCurrentUser(null);
      return null;
    }
  }
  try {
    const me = await api<SessionUser>("/auth/me");
    setCurrentUser(me);
    return me;
  } catch {
    setCurrentUser(null);
    return null;
  }
}

// ---------------------------------------------------------------- review queue

export type Verdict = "APPROVE" | "FLAG" | "REJECT";
export type Difficulty = "FOUNDATION" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QueueItem {
  id: string;
  stem: string;
  explanation: string | null;
  sourceRef: string | null;
  difficulty: Difficulty;
  status: string;
  origin: string;
  autoReviewVerdict: Verdict | null;
  autoReviewConfidence: string | null;
  autoReviewNotes: string | null;
  autoReviewIssues: string[];
  independentAnswerAgreed: boolean | null;
  reviewPriority: number | null;
  topic: { id: string; slug: string; name: string };
  options: QuestionOption[];
}

export interface QueuePage {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  items: QueueItem[];
}

export interface ReviewStats {
  pending: number;
  published: number;
  byVerdict: Record<string, number>;
  byDifficulty: Record<string, number>;
  byOrigin: { AI_GENERATED: number; HUMAN: number };
}

export function fetchStats(): Promise<ReviewStats> {
  return api<ReviewStats>("/admin/questions/review-stats");
}

export type QuestionStatusValue = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "REJECTED" | "RETIRED";
export type QuestionOriginValue = "HUMAN" | "AI_GENERATED" | "IMPORTED";

export function fetchQueue(params: {
  verdict?: Verdict;
  difficulty?: Difficulty;
  topicSlug?: string;
  status?: QuestionStatusValue;
  origin?: QuestionOriginValue;
  page?: number;
  pageSize?: number;
}): Promise<QueuePage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return api<QueuePage>(`/admin/questions/review-queue?${qs.toString()}`);
}

export function approveQuestion(id: string, notes?: string): Promise<unknown> {
  return api(`/admin/questions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(notes ? { notes } : {}),
  });
}

export function rejectQuestion(id: string, reason: string): Promise<unknown> {
  return api(`/admin/questions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function bulkApprove(questionIds: string[]): Promise<{
  approvedCount: number;
  approved: string[];
  skipped: Array<{ id: string; reason: string }>;
}> {
  return api("/admin/questions/bulk-approve", {
    method: "POST",
    body: JSON.stringify({ questionIds }),
  });
}

// ---------------------------------------------------------------- membership

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "email" | "tel";
  required: boolean;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface DocumentRequirement {
  kind: string;
  label: string;
  required: boolean;
  help?: string;
}

export interface TierInfo {
  tier: "STUDENT" | "PROFESSIONAL" | "EXECUTIVE" | "FELLOW" | "RETIRED";
  displayName: string;
  designation: string | null;
  priceUsdCents: number;
  requiresExam: boolean;
  requiresPanel: boolean;
  examQuestionCount: number | null;
  examDurationMins: number | null;
  passMarkBps: number | null;
  attemptsPerEntitlement: number | null;
  resitPriceUsdCents: number | null;
  form: { sections: Array<{ title: string; fields: FieldDef[] }>; documents: DocumentRequirement[] };
}

export type NextAction =
  | { kind: "APPLY"; message: string }
  | { kind: "COMPLETE_DRAFT"; message: string; applicationId: string }
  | { kind: "AWAIT_REVIEW"; message: string }
  | { kind: "PAY"; message: string; amountUsdCents: number; chargeAmount: number | null; chargeCurrency: string | null }
  | { kind: "SIT_EXAM"; message: string }
  | { kind: "NONE"; message: string };

export interface MembershipStatus {
  membership: { memberNumber: string; tier: string; status: string; currentPeriodEnd: string | null } | null;
  benefitsLocked: boolean;
  latestApplication: {
    id: string;
    tier: string;
    status: string;
    decisionReason: string | null;
    submittedAt: string | null;
  } | null;
  nextAction: NextAction;
}

/** Public — no auth required, so usable from server components too. */
export async function fetchTiers(): Promise<TierInfo[]> {
  const res = await fetch(`${API_URL}/membership/tiers`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, "Could not load membership tiers");
  return res.json();
}

export function fetchMembershipStatus(): Promise<MembershipStatus> {
  return api<MembershipStatus>("/membership/status");
}

export function saveApplicationDraft(tier: string, answers: Record<string, unknown>) {
  return api<{ id: string; tier: string; status: string; documents: ApplicationDocumentView[] }>(
    "/membership/applications",
    { method: "POST", body: JSON.stringify({ tier, answers }) },
  );
}

export function submitApplication(id: string) {
  return api(`/membership/applications/${id}/submit`, { method: "POST" });
}

export interface ApplicationDocumentView {
  id: string;
  kind: string;
  originalName: string;
  sizeBytes: number;
  scanStatus: string;
  uploadedAt: string;
  mimeType?: string;
}

export type TierFormDef = TierInfo["form"];

/** One application with everything needed to show it: answers, files and the form's labels. */
export interface ApplicationRecord {
  id: string;
  tier: MembershipTierValue;
  status: AdminApplicationStatus;
  answers: Record<string, unknown>;
  submittedAt: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents: ApplicationDocumentView[];
  form: TierFormDef;
}

export interface ProfileView {
  gender: "MALE" | "FEMALE" | "UNSPECIFIED";
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  highestQualification: string | null;
  yearOfGraduation: number | null;
  occupation: string | null;
  employer: string | null;
  institution: string | null;
  institutionLevel: string | null;
  programOfStudy: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublicInDirectory?: boolean;
}

/** The member's own applications, newest first. */
export function fetchMyApplications(): Promise<ApplicationRecord[]> {
  return api<ApplicationRecord[]>("/membership/applications");
}

/** Take a submitted application back out of review so it can be edited. */
export function reopenApplication(id: string) {
  return api<{ id: string; status: string }>(`/membership/applications/${id}/reopen`, { method: "POST" });
}

/** Where a document's file and Word preview live: the member's own route, or the admin route. */
export type DocumentScope = "member" | "admin";
function documentBase(scope: DocumentScope, applicationId: string, documentId: string) {
  return scope === "admin"
    ? `/admin/applications/${applicationId}/documents/${documentId}`
    : `/membership/applications/${applicationId}/documents/${documentId}`;
}

/** Fetches a document with the session's credentials and returns a local blob URL for on-page viewing. */
export async function fetchDocumentBlobUrl(scope: DocumentScope, applicationId: string, documentId: string): Promise<string> {
  const path = `${documentBase(scope, applicationId, documentId)}/file`;
  let res = await rawFetch(path);
  if (res.status === 401 && getRefreshToken()) {
    if (await refreshSession()) res = await rawFetch(path);
  }
  if (!res.ok) throw await parseError(res);
  return URL.createObjectURL(await res.blob());
}

/** Sanitised HTML for a Word (.docx) file; null when there is no preview (e.g. old .doc files). */
export function fetchDocumentPreview(scope: DocumentScope, applicationId: string, documentId: string) {
  return api<{ html: string | null }>(`${documentBase(scope, applicationId, documentId)}/preview`);
}

/** Saves a document to the user's computer under its original name. */
export async function downloadDocument(scope: DocumentScope, applicationId: string, doc: { id: string; originalName: string }) {
  const url = await fetchDocumentBlobUrl(scope, applicationId, doc.id);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.originalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function uploadApplicationDocument(applicationId: string, kind: string, file: File): Promise<ApplicationDocumentView> {
  const form = new FormData();
  form.append("file", file);
  return api(`/membership/applications/${applicationId}/documents?kind=${encodeURIComponent(kind)}`, {
    method: "POST",
    body: form,
  });
}

export function deleteApplicationDocument(applicationId: string, documentId: string): Promise<{ removed: true }> {
  return api(`/membership/applications/${applicationId}/documents/${documentId}`, { method: "DELETE" });
}

/** Fetches the file as a blob (auth header required) and opens it in a new tab. */
export async function viewApplicationDocument(applicationId: string, documentId: string): Promise<void> {
  let res = await rawFetch(`/membership/applications/${applicationId}/documents/${documentId}/file`);
  if (res.status === 401 && getRefreshToken()) {
    if (await refreshSession()) res = await rawFetch(`/membership/applications/${applicationId}/documents/${documentId}/file`);
  }
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // Revoke well after the new tab has had time to load the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

/** Minor units of any currency, e.g. 62500 GHS -> "GHS 625.00". */
export function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------- payments

export interface PaymentView {
  id: string;
  reference: string;
  purpose: string;
  status: "INITIALIZED" | "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED" | "REFUNDED";
  amount: number;
  currency: string;
  amountUsdCents: number;
  channel: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface InitializedPayment {
  reference: string;
  accessCode: string;
  amount: number;
  currency: string;
  amountUsdCents: number;
}

export function initializeMembershipPayment(): Promise<InitializedPayment> {
  return api("/payments/membership/initialize", { method: "POST" });
}

export function verifyPayment(reference: string): Promise<PaymentView> {
  return api(`/payments/${encodeURIComponent(reference)}/verify`, { method: "POST" });
}

export function fetchMyPayments(): Promise<PaymentView[]> {
  return api("/payments/mine");
}

export interface AdminPaymentItem extends PaymentView {
  user: { id: string; email: string; firstName: string; lastName: string };
}

export function fetchAdminPayments(params: { status?: string; page?: number } = {}): Promise<{
  items: AdminPaymentItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.page) q.set("page", String(params.page));
  return api(`/admin/payments?${q.toString()}`);
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  acceptedTerms: true;
  marketingOptIn: boolean;
}

export async function register(input: RegisterInput): Promise<{ id: string; email: string }> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

// ---------------------------------------------------------------- admin: users

export type AdminRole = "MEMBER" | "REVIEWER" | "ADMIN" | "SUPERADMIN";
export type AdminUserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DELETED";

export interface AdminUserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AdminRole;
  status: AdminUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserPage {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function fetchUsers(params: {
  query?: string;
  role?: AdminRole;
  status?: AdminUserStatus;
  page?: number;
  pageSize?: number;
}): Promise<AdminUserPage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  return api<AdminUserPage>(`/admin/users?${qs.toString()}`);
}

export function setUserRole(id: string, role: AdminRole): Promise<AdminUserListItem> {
  return api(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
}

export function setUserStatus(id: string, status: "ACTIVE" | "SUSPENDED"): Promise<AdminUserListItem> {
  return api(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export function deleteUser(id: string): Promise<AdminUserListItem> {
  return api(`/admin/users/${id}`, { method: "DELETE" });
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  emailVerifiedAt: string | null;
  profile: ProfileView | null;
  membership: {
    memberNumber: string;
    tier: MembershipTierValue;
    status: string;
    activatedAt: string | null;
    currentPeriodEnd: string | null;
  } | null;
  applications: ApplicationRecord[];
}

export function fetchAdminUser(id: string): Promise<AdminUserDetail> {
  return api(`/admin/users/${id}`);
}

export interface AdminUserUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  profile?: Partial<Omit<ProfileView, "isPublicInDirectory">>;
}

/** SUPERADMIN only. */
export function updateAdminUser(id: string, body: AdminUserUpdate): Promise<AdminUserDetail> {
  return api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------- admin: membership applications

export type AdminApplicationStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "DECLINED" | "WITHDRAWN";
export type MembershipTierValue = "STUDENT" | "PROFESSIONAL" | "EXECUTIVE" | "FELLOW" | "RETIRED";

export interface AdminApplicationListItem {
  id: string;
  tier: MembershipTierValue;
  status: AdminApplicationStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { id: string; email: string; firstName: string; lastName: string };
  documentCount?: number;
}

export interface AdminApplicationPage {
  items: AdminApplicationListItem[];
  total: number;
  counts?: Partial<Record<AdminApplicationStatus, number>>;
  page: number;
  pageSize: number;
}

export interface AdminApplicationDetail extends AdminApplicationListItem {
  answers: Record<string, unknown>;
  decisionReason: string | null;
  reviewerNotes: string | null;
  reviewer: { firstName: string; lastName: string } | null;
  user: {
    id: string;
    email: string;
    emailVerifiedAt: string | null;
    firstName: string;
    lastName: string;
    phone: string | null;
    createdAt: string;
    profile: ProfileView | null;
    membership: { memberNumber: string; tier: string; status: string; currentPeriodEnd: string | null } | null;
  };
  documents: ApplicationDocumentView[];
  form: TierFormDef;
  history: Array<{
    id: string;
    tier: MembershipTierValue;
    status: AdminApplicationStatus;
    submittedAt: string | null;
    reviewedAt: string | null;
    decisionReason: string | null;
  }>;
}

export function fetchApplications(params: {
  status?: AdminApplicationStatus;
  query?: string;
  tier?: MembershipTierValue;
  page?: number;
  pageSize?: number;
}): Promise<AdminApplicationPage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  return api<AdminApplicationPage>(`/admin/applications?${qs.toString()}`);
}

export function fetchApplication(id: string): Promise<AdminApplicationDetail> {
  return api(`/admin/applications/${id}`);
}

export function approveApplication(id: string, notes?: string): Promise<unknown> {
  return api(`/admin/applications/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(notes ? { notes } : {}),
  });
}

export function declineApplication(id: string, reason: string): Promise<unknown> {
  return api(`/admin/applications/${id}/decline`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

// ---------------------------------------------------------------- public content

async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, `Could not load ${path}`);
  return res.json();
}

export interface CourseListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  provider: "PACA" | "PARTNER";
  isFree: boolean;
  priceUsdCents: number;
  durationMins: number | null;
  externalUrl: string | null;
  partner: { name: string; slug: string } | null;
}

export interface PartnerListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
}

export interface ResourceListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kind: string;
  externalUrl: string | null;
  minTier: string | null;
  tiers: MembershipTierValue[];
  memberOnly: boolean;
  topic: { name: string } | null;
}

export interface FaqListItem {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface JobTeaser {
  total: number;
  latest: Array<{ id: string; title: string; company: string; location: string | null; isRemote: boolean; agileRole: string | null; seniority: string | null }>;
}

export interface DirectoryListItem {
  occupation: string | null;
  employer: string | null;
  institution: string | null;
  country: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  user: { firstName: string; lastName: string; membership: { tier: MembershipTierValue; status: string; memberNumber: string } | null };
}

export const fetchCourses = () => publicFetch<CourseListItem[]>("/courses");
export const fetchPartners = () => publicFetch<PartnerListItem[]>("/partners");
export const fetchResources = () => publicFetch<ResourceListItem[]>("/resources");
export const fetchFaqItems = () => publicFetch<FaqListItem[]>("/faq");
export const fetchJobTeaser = () => publicFetch<JobTeaser>("/jobs");
export const fetchDirectory = () => publicFetch<DirectoryListItem[]>("/directory");

// ---------------------------------------------------------------- assessment (PACA open assessment)

export interface AssessmentQuestionView {
  position: number;
  questionId: string;
  stem: string;
  kind: "SINGLE_CHOICE" | "MULTI_CHOICE";
  selectedOptionIds: string[];
  options: Array<{ id: string; text: string }>;
}

export interface AssessmentAttemptView {
  id: string;
  type?: "FREE_OPEN" | "CERTIFICATION";
  status: "IN_PROGRESS";
  expiresAt: string;
  questionCount: number;
  durationMins: number;
  questions: AssessmentQuestionView[];
}

export interface AssessmentResultView {
  id: string;
  type?: "FREE_OPEN" | "CERTIFICATION";
  sharedAt?: string | null;
  status: "SUBMITTED" | "EXPIRED";
  questionCount: number;
  correctCount: number;
  scoreBps: number;
  passed: boolean;
  passMarkBps: number;
  certificate: { id: string; credentialId: string } | null;
  /** Advisory competency band for the free test. */
  competency: { level: "Foundation" | "Developing" | "Proficient" | "Advanced"; advice: string };
  /** Weakest topics first. */
  topics: Array<{ topic: string; correct: number; total: number }>;
  /** No answer key — only the candidate's own choices and whether each was right. */
  review: Array<{
    stem: string;
    isCorrect: boolean | null;
    selectedOptionIds: string[];
    options: Array<{ id: string; text: string }>;
    /** Free test only — the certification exam never reveals its key. */
    correctOptionIds?: string[] | null;
    explanation?: string | null;
  }>;
}

export function fetchActiveAssessment(): Promise<AssessmentAttemptView | null> {
  return api("/assessment/active");
}

export function startAssessment(): Promise<AssessmentAttemptView> {
  return api("/assessment/start", { method: "POST" });
}

export function fetchAssessment(id: string): Promise<AssessmentAttemptView | AssessmentResultView> {
  return api(`/assessment/${id}`);
}

export function answerAssessmentQuestion(id: string, questionId: string, selectedOptionIds: string[]): Promise<{ saved: true }> {
  return api(`/assessment/${id}/answer`, {
    method: "POST",
    body: JSON.stringify({ questionId, selectedOptionIds }),
  });
}

export function submitAssessment(id: string): Promise<AssessmentResultView> {
  return api(`/assessment/${id}/submit`, { method: "POST" });
}

// ---------------------------------------------------------------- admin: activity log

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string; email: string; role: string } | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function fetchActivity(params: { action?: string; entityType?: string; page?: number; pageSize?: number }): Promise<ActivityPage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  return api<ActivityPage>(`/admin/activity?${qs.toString()}`);
}

export function fetchActivityActions(): Promise<string[]> {
  return api("/admin/activity/actions");
}

// ---------------------------------------------------------------- admin: exam performance

export interface AdminAttemptItem {
  id: string;
  type: "FREE_OPEN" | "CERTIFICATION";
  tier: string | null;
  status: string;
  questionCount: number;
  correctCount: number | null;
  scoreBps: number | null;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export interface AdminAttemptPage {
  items: AdminAttemptItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function fetchAdminAssessments(params: { status?: string; passed?: boolean; page?: number; pageSize?: number }): Promise<AdminAttemptPage> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  return api<AdminAttemptPage>(`/admin/assessments?${qs.toString()}`);
}

export function fetchAdminAssessmentStats(): Promise<{ total: number; submitted: number; passed: number }> {
  return api("/admin/assessments/stats");
}

// ---------------------------------------------------------------- certificates

export interface CertificateItem {
  id: string;
  credentialId: string;
  tier: string | null;
  holderName: string;
  scoreBps: number | null;
  issuedAt: string;
  status: "VALID" | "SUSPENDED" | "REVOKED";
}

export interface VerifyResult {
  credentialId: string;
  holderName: string;
  tier: string | null;
  designation: string | null;
  scoreBps: number | null;
  issuedAt: string;
  status: "VALID" | "SUSPENDED" | "REVOKED";
  revokedReason: string | null;
}

export function fetchMyCertificates(): Promise<CertificateItem[]> {
  return api("/certificates/mine");
}

/** Opens the certificate PDF in a new tab (auth required — reuses the same pattern as document viewing). */
export async function viewCertificatePdf(id: string): Promise<void> {
  let res = await rawFetch(`/certificates/${id}/pdf`);
  if (res.status === 401 && getRefreshToken()) {
    if (await refreshSession()) res = await rawFetch(`/certificates/${id}/pdf`);
  }
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Public — no auth. Used by the /verify/[credentialId] page. */
export async function verifyCertificate(credentialId: string): Promise<VerifyResult> {
  const res = await fetch(`${API_URL}/verify/${encodeURIComponent(credentialId)}`, { cache: "no-store" });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export function certificatePdfUrl(credentialId: string): string {
  return `${PUBLIC_API_URL}/verify/${encodeURIComponent(credentialId)}/pdf`;
}

// ---------------------------------------------------------------- email verification

export async function verifyEmail(code: string): Promise<{ verified: true }> {
  const result = await api<{ verified: true }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ code }) });
  patchCurrentUser({ emailVerifiedAt: new Date().toISOString(), status: "ACTIVE" });
  return result;
}

export function resendVerificationCode(): Promise<{ sentTo: string }> {
  return api("/auth/verify-email/resend", { method: "POST", body: JSON.stringify({}) });
}

// ---------------------------------------------------------------- member library

export const TIER_LABEL: Record<MembershipTierValue, string> = {
  STUDENT: "Student",
  PROFESSIONAL: "Professional",
  EXECUTIVE: "Executive",
  FELLOW: "Fellow",
  RETIRED: "Retired",
};

export interface LibraryBook {
  id: string;
  title: string;
  description: string | null;
  tiers: MembershipTierValue[];
  fileName: string | null;
  fileSizeBytes: number | null;
  publishedAt: string | null;
  locked: boolean;
}

export function fetchMemberLibrary(): Promise<{ unlocked: boolean; tier: MembershipTierValue | null; items: LibraryBook[] }> {
  return api("/library");
}

/** Fetches the PDF with the auth header and opens it in a new tab to read. */
export async function openLibraryBook(id: string): Promise<void> {
  // Open the tab synchronously (inside the click) so popup blockers allow it.
  const tab = window.open("", "_blank");
  try {
    let res = await rawFetch(`/library/${id}/file`);
    if (res.status === 401 && getRefreshToken()) {
      if (await refreshSession()) res = await rawFetch(`/library/${id}/file`);
    }
    if (!res.ok) throw await parseError(res);
    const url = URL.createObjectURL(await res.blob());
    if (tab) tab.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export interface AdminLibraryBook {
  id: string;
  title: string;
  description: string | null;
  tiers: MembershipTierValue[];
  fileName: string | null;
  fileSizeBytes: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  downloadCount: number;
  createdAt: string;
}

export function fetchAdminLibrary(): Promise<AdminLibraryBook[]> {
  return api("/admin/library");
}

export function uploadLibraryBook(input: {
  title: string;
  description: string;
  tiers: MembershipTierValue[];
  file: File;
}): Promise<AdminLibraryBook> {
  const form = new FormData();
  // Text fields first: the API reads them from the parts that precede the file.
  form.append("title", input.title);
  form.append("description", input.description);
  form.append("tiers", input.tiers.join(","));
  form.append("file", input.file);
  return api("/admin/library", { method: "POST", body: form });
}

export function updateLibraryBook(
  id: string,
  patch: { title?: string; description?: string | null; tiers?: MembershipTierValue[]; published?: boolean },
): Promise<AdminLibraryBook> {
  return api(`/admin/library/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteLibraryBook(id: string): Promise<void> {
  return api(`/admin/library/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------- partner course discounts

export interface PartnerOffer {
  slug: string;
  /** null = still being agreed with the partner. */
  discountPercent: number | null;
}

export const fetchPartnerOffers = () => publicFetch<PartnerOffer[]>("/partner-offers");

export interface MemberPartnerOffer {
  eligible: boolean;
  discountPercent: number | null;
  code: string | null;
  note: string | null;
}

export function fetchMyPartnerOffer(slug: string): Promise<MemberPartnerOffer> {
  return api(`/partner-offers/${slug}/mine`);
}

export interface AdminPartnerOffer {
  slug: string;
  name: string;
  discountPercent: number | null;
  code: string | null;
  note: string | null;
}

export function fetchAdminPartnerOffers(): Promise<AdminPartnerOffer[]> {
  return api("/admin/partner-offers");
}

export function saveAdminPartnerOffer(
  slug: string,
  body: { discountPercent: number | null; code: string | null; note: string | null },
): Promise<AdminPartnerOffer> {
  return api(`/admin/partner-offers/${slug}`, { method: "PUT", body: JSON.stringify(body) });
}

// ---------------------------------------------------------------- certification exam

export interface ExamStatus {
  eligible: boolean;
  reason: string | null;
  tier: MembershipTierValue | null;
  tierName: string | null;
  questionCount: number | null;
  durationMins: number | null;
  passMarkBps: number | null;
  attemptsRemaining: number;
  attemptsTotal: number;
  certificate: { id: string; credentialId: string; issuedAt: string } | null;
  lastAttempt: { id: string; scoreBps: number | null; passed: boolean | null; submittedAt: string | null } | null;
  activeAttempt: AssessmentAttemptView | null;
}

export const fetchExamStatus = () => api<ExamStatus>("/exam/status");
export const startExam = () => api<AssessmentAttemptView>("/exam/start", { method: "POST" });

// ---------------------------------------------------------------- sharing

export function shareAssessment(id: string): Promise<{ id: string }> {
  return api(`/assessment/${id}/share`, { method: "POST", body: JSON.stringify({}) });
}

export interface PublicScore {
  id: string;
  name: string;
  scoreBps: number;
  correctCount: number;
  questionCount: number;
  level: string;
  takenAt: string;
}
export const fetchPublicScore = (id: string) => publicFetch<PublicScore>(`/public/scores/${encodeURIComponent(id)}`);

export interface PublicMember {
  memberNumber: string;
  name: string;
  tier: MembershipTierValue;
  tierName: string;
  designation: string | null;
  inGoodStanding: boolean;
  memberSince: string;
  validUntil: string | null;
  certificates: Array<{ credentialId: string; tier: MembershipTierValue | null; designation: string | null; issuedAt: string }>;
}
export const fetchPublicMember = (memberNumber: string) =>
  publicFetch<PublicMember>(`/public/members/${encodeURIComponent(memberNumber)}`);

/** Absolute public site URL for share links (falls back to the current origin in the browser). */
export function siteUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "https://pac-a.org");
  return `${base.replace(/\/$/, "")}${path}`;
}

// ---------------------------------------------------------------- notifications + announcements

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
export const fetchNotifications = () => api<{ unread: number; items: NotificationItem[] }>("/notifications");
export const markAllNotificationsRead = () => api("/notifications/read-all", { method: "POST", body: JSON.stringify({}) });
export const markNotificationRead = (id: string) => api(`/notifications/${id}/read`, { method: "POST", body: JSON.stringify({}) });

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
  pinned: boolean;
  discountCode: string | null;
}
export const fetchAnnouncements = () => api<AnnouncementItem[]>("/announcements");

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  audience: "ALL_USERS" | "ALL_MEMBERS" | "BY_TIER" | "SPECIFIC_USERS";
  visibleToTiers: MembershipTierValue[];
  publishedAt: string | null;
  pinnedUntil: string | null;
  createdAt: string;
}
export const fetchAdminAnnouncements = () => api<AdminAnnouncement[]>("/admin/announcements");
export const createAnnouncement = (body: {
  title: string;
  body: string;
  audience: "ALL_USERS" | "ALL_MEMBERS" | "BY_TIER";
  tiers: MembershipTierValue[];
  publish: boolean;
  pinDays: number | null;
  discountCode: string | null;
}) => api<AdminAnnouncement>("/admin/announcements", { method: "POST", body: JSON.stringify(body) });
export const publishAnnouncement = (id: string) =>
  api<AdminAnnouncement>(`/admin/announcements/${id}/publish`, { method: "POST", body: JSON.stringify({}) });
export const deleteAnnouncement = (id: string) => api<void>(`/admin/announcements/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------- profile + network

export interface MemberProfile {
  occupation: string | null;
  employer: string | null;
  country: string | null;
  city: string | null;
  linkedinUrl: string | null;
  bio: string | null;
  isPublicInDirectory: boolean;
}
export const fetchMyProfile = () => api<MemberProfile>("/me/profile");
export const updateMyProfile = (patch: Partial<MemberProfile>) =>
  api<MemberProfile>("/me/profile", { method: "PATCH", body: JSON.stringify(patch) });

export interface NetworkMember {
  name: string;
  tier: MembershipTierValue | null;
  memberNumber: string | null;
  occupation: string | null;
  employer: string | null;
  country: string | null;
  city: string | null;
  linkedinUrl: string | null;
  bio: string | null;
}
export const fetchNetwork = (q?: string) => api<NetworkMember[]>(`/network${q ? `?q=${encodeURIComponent(q)}` : ""}`);

// ---------------------------------------------------------------- jobs

export const AGILE_ROLE_LABEL: Record<string, string> = {
  SCRUM_MASTER: "Scrum Master",
  PRODUCT_OWNER: "Product Owner",
  PRODUCT_MANAGER: "Product Manager",
  AGILE_COACH: "Agile Coach",
  RELEASE_TRAIN_ENGINEER: "Release Train Engineer",
  DELIVERY_MANAGER: "Delivery / Project Manager",
  BUSINESS_ANALYST: "Business Analyst",
  AGILE_TRAINER: "Agile Trainer",
  OTHER: "Other Agile role",
};

export const SENIORITY_LABEL: Record<string, string> = {
  ENTRY: "Entry level",
  MID: "Mid level",
  SENIOR: "Senior",
  LEAD: "Lead",
  EXECUTIVE: "Executive",
};

export interface MemberJob {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  location: string | null;
  isRemote: boolean;
  employmentType: string | null;
  summary: string | null;
  applyUrl: string;
  agileRole: string | null;
  seniority: string | null;
  postedAt: string | null;
  source: { name: string };
}
export function fetchMemberJobs(q: { role?: string; remote?: boolean; q?: string; page?: number }) {
  const p = new URLSearchParams();
  if (q.role) p.set("role", q.role);
  if (q.remote) p.set("remote", "true");
  if (q.q) p.set("q", q.q);
  if (q.page) p.set("page", String(q.page));
  return api<{ total: number; page: number; pageSize: number; items: MemberJob[] }>(`/member-jobs?${p}`);
}

export interface AdminJobSource {
  id: string;
  name: string;
  kind: string;
  config: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  _count: { listings: number };
}
export interface AdminJobListing {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  summary: string | null;
  applyUrl: string;
  agileRole: string | null;
  seniority: string | null;
  aiConfidence: string | null;
  status: string;
  fetchedAt: string;
  source: { name: string };
}
export const fetchJobSources = () => api<AdminJobSource[]>("/admin/jobs/sources");
export const addJobSource = (body: { kind: "GREENHOUSE" | "LEVER"; name: string; handle: string }) =>
  api<AdminJobSource>("/admin/jobs/sources", { method: "POST", body: JSON.stringify(body) });
export const toggleJobSource = (id: string, isActive: boolean) =>
  api<AdminJobSource>(`/admin/jobs/sources/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
export const runJobCrawl = () =>
  api<{ started: boolean; message?: string; ai?: boolean; summary?: Array<{ source: string; fetched: number; added: number; published: number; error?: string }> }>(
    "/admin/jobs/run",
    { method: "POST", body: JSON.stringify({}) },
  );
export const fetchAdminJobListings = (status: string) => api<AdminJobListing[]>(`/admin/jobs/listings?status=${status}`);
export const reviewJobListing = (id: string, status: "PUBLISHED" | "REJECTED") =>
  api(`/admin/jobs/listings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });

// ---------------------------------------------------------------- events

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  isOnline: boolean;
  registerUrl: string | null;
  priceText: string | null;
  memberDiscountPercent: number | null;
  /** Only present for paid members. */
  memberDiscountCode?: string | null;
}

export const fetchEvents = () => publicFetch<EventItem[]>("/events");
export const fetchMemberEvents = () => api<{ paid: boolean; items: EventItem[] }>("/member-events");

export interface AdminEvent extends EventItem {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  memberDiscountCode: string | null;
  createdAt: string;
}
export const fetchAdminEvents = () => api<AdminEvent[]>("/admin/events");
export const createEvent = (body: {
  title: string;
  summary: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  isOnline: boolean;
  registerUrl: string | null;
  priceText: string | null;
  memberDiscountPercent: number | null;
  memberDiscountCode: string | null;
  publish: boolean;
}) => api<AdminEvent>("/admin/events", { method: "POST", body: JSON.stringify(body) });
export const publishEvent = (id: string) => api<AdminEvent>(`/admin/events/${id}/publish`, { method: "POST", body: JSON.stringify({}) });
export const deleteEvent = (id: string) => api<void>(`/admin/events/${id}`, { method: "DELETE" });
