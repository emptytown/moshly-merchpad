const HUB_TIMEOUT_MS = 8_000;
const HUB_URL        = process.env.MOSHLY_HUB_URL    || "https://moshly.io";
const APP_SECRET     = process.env.MOSHLY_APP_SECRET  || "";

export type QuotaResource = "ai_credits" | "pdf_exports";

export interface QuotaBalance {
  used: number;
  limit: number;
  remaining: number;
}

type ConsumeResult =
  | { success: true; used: number; limit: number; remaining: number }
  | { error: string };

function isConfigured(): boolean {
  return !!(HUB_URL && APP_SECRET);
}

async function hubPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${HUB_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${APP_SECRET}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
  });
}

async function hubGet(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(`${HUB_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${APP_SECRET}` },
    signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
  });
}

export async function getQuotaBalance(userId: string, resource: QuotaResource): Promise<QuotaBalance | null> {
  if (!isConfigured()) return null;
  try {
    const res = await hubGet("/api/internal/quota/balance", { userId, resource });
    if (!res.ok) return null;
    const body = await res.json() as QuotaBalance;
    return typeof body.remaining === "number" ? body : null;
  } catch {
    return null;
  }
}

export async function consumeQuota(userId: string, resource: QuotaResource, amount = 1): Promise<ConsumeResult> {
  if (!isConfigured()) {
    console.warn(`[hub] Skipping ${resource} debit — not configured`);
    return { success: true, used: 0, limit: 0, remaining: 0 };
  }
  try {
    const res = await hubPost("/api/internal/quota/consume", { userId, resource, amount });
    return await res.json() as ConsumeResult;
  } catch (err) {
    console.error("[hub] quota consume failed", { userId, resource, amount, err });
    return { error: "unreachable" };
  }
}

export function consumeQuotaBackground(userId: string, resource: QuotaResource, amount = 1): void {
  if (!isConfigured()) return;
  hubPost("/api/internal/quota/consume", { userId, resource, amount })
    .then(async (res) => {
      if (!res.ok) console.warn("[hub] background debit failed", { userId, resource, status: res.status });
    })
    .catch((err) => console.error("[hub] background debit error", { userId, resource, err }));
}
