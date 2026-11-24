// Moshly quota client — the app's server talks to moshly.io for AI credits and
// PDF exports. Same contract in every Moshly app; see AI-PDF-CSV-QUOTA.md in
// moshly-site. `userId` is always the Moshly user id from SSO.
const HUB_URL = (process.env.MOSHLY_HUB_URL || "https://moshly.io").replace(/\/+$/, "");
const APP_SECRET = process.env.MOSHLY_APP_SECRET || "";

const APP_ID = "merchpad";
const HUB_TIMEOUT_MS = 8_000;

export type QuotaResource = "ai_credits" | "pdf_exports";

export interface QuotaSnapshot {
  resource: QuotaResource;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface QuotaOverview {
  plan: string;
  resetsAt: string;
  quotas: Record<QuotaResource, QuotaSnapshot>;
}

export type ConsumeOutcome =
  | { ok: true; quota: QuotaSnapshot | null }
  | { ok: false; reason: "insufficient" | "no_subscription" | "unavailable"; quota?: QuotaSnapshot };

/** No dev bypass user in this app: every call goes to the Hub. */
function isDevUser(_userId: string): boolean {
  return false;
}

export function isHubConfigured(): boolean {
  return !!(HUB_URL && APP_SECRET);
}

function hubHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${APP_SECRET}`,
    "X-Moshly-App": APP_ID,
    Accept: "application/json",
  };
}

/** Parses a Hub answer. Anything that is not JSON (e.g. an HTML page) is an error. */
async function readJson(res: Response): Promise<Record<string, any> | null> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return null;
  try {
    return (await res.json()) as Record<string, any>;
  } catch {
    return null;
  }
}

async function hubPost(path: string, body: unknown): Promise<{ status: number; data: Record<string, any> | null }> {
  const res = await fetch(`${HUB_URL}${path}`, {
    method: "POST",
    headers: { ...hubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
  });
  return { status: res.status, data: await readJson(res) };
}

/** This month's quotas for the user, or null if the Hub can't be reached. */
export async function getQuotaOverview(userId: string): Promise<QuotaOverview | null> {
  if (!isHubConfigured()) return null;
  try {
    const url = new URL(`${HUB_URL}/api/internal/quota/balance`);
    url.searchParams.set("userId", userId);
    const res = await fetch(url, { headers: hubHeaders(), signal: AbortSignal.timeout(HUB_TIMEOUT_MS) });
    const data = await readJson(res);
    if (!res.ok || !data?.quotas) {
      console.warn("[hub] balance failed", { userId, status: res.status, error: data?.error });
      return null;
    }
    return data as QuotaOverview;
  } catch (err) {
    console.error("[hub] balance unreachable", { userId, err: err instanceof Error ? err.message : err });
    return null;
  }
}

/**
 * Spends quota BEFORE the paid work. Fails closed: if the Hub can't be reached
 * the work must not happen. Call refundQuota() if the work then fails.
 */
export async function consumeQuota(userId: string, resource: QuotaResource, amount = 1): Promise<ConsumeOutcome> {
  if (isDevUser(userId)) return { ok: true, quota: null };
  if (!isHubConfigured()) {
    console.error(`[hub] cannot debit ${resource}: MOSHLY_HUB_URL or MOSHLY_APP_SECRET not set`);
    return { ok: false, reason: "unavailable" };
  }
  try {
    const { status, data } = await hubPost("/api/internal/quota/consume", { userId, resource, amount });
    if (status === 200 && data?.success) return { ok: true, quota: data as QuotaSnapshot };
    if (status === 402) return { ok: false, reason: "insufficient", quota: data as QuotaSnapshot };
    if (status === 404 && data?.error === "no_subscription") return { ok: false, reason: "no_subscription" };
    console.error("[hub] consume failed", { userId, resource, amount, status, error: data?.error ?? "non-JSON answer" });
    return { ok: false, reason: "unavailable" };
  } catch (err) {
    console.error("[hub] consume unreachable", { userId, resource, amount, err: err instanceof Error ? err.message : err });
    return { ok: false, reason: "unavailable" };
  }
}

/** Gives quota back after the paid work failed. Best effort: logs, never throws. */
export async function refundQuota(userId: string, resource: QuotaResource, amount = 1): Promise<void> {
  if (isDevUser(userId) || !isHubConfigured()) return;
  try {
    const { status, data } = await hubPost("/api/internal/quota/refund", { userId, resource, amount });
    if (status !== 200) console.warn("[hub] refund failed", { userId, resource, amount, status, error: data?.error });
  } catch (err) {
    console.error("[hub] refund unreachable", { userId, resource, amount, err: err instanceof Error ? err.message : err });
  }
}

function formatResetDate(iso?: string): string {
  if (!iso) return "the start of next month";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/** The message to show the user when consumeQuota() refuses. */
export function quotaRefusalMessage(outcome: Exclude<ConsumeOutcome, { ok: true }>, resource: QuotaResource): string {
  if (outcome.reason === "no_subscription") {
    return "No Moshly plan was found for your account. Open Moshly to set one up.";
  }
  if (outcome.reason === "unavailable") {
    return "Moshly couldn't check your plan just now. Please try again in a moment.";
  }
  const resets = formatResetDate(outcome.quota?.resetsAt);
  if (resource === "pdf_exports") {
    return outcome.quota?.limit === 0
      ? "PDF exports aren't included in your plan. Upgrade on Moshly to export PDFs."
      : `You've used all your PDF exports for this month. They renew on ${resets}, or upgrade on Moshly.`;
  }
  return `You've run out of AI credits for this month. They renew on ${resets}, or upgrade on Moshly.`;
}
