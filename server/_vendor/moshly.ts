/**
 * Moshly client for app servers: AI and quotas through moshly.io.
 *
 * Vendored into each app (copy this file, do not edit the copy). Source of
 * truth: emptytown/moshly-modules, modules/MoshlyAI/moshly.ts.
 * Zero dependencies; needs a global fetch (Node 18+).
 *
 * The app never holds an AI provider key. moshly.io spends the user's credits,
 * calls the model and refunds them if the call fails. `userId` is always the
 * Moshly user id from SSO (`user.id` from /api/auth/sso/verify).
 */

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
  /** Credits each AI feature costs, e.g. { "quote.chat": 2 }. */
  aiFeatures: Record<string, number>;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type AIResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };

export interface AIChatRequest {
  userId: string;
  /** Registered on moshly.io as `<app>.<action>`, e.g. "quote.chat". Sets the credit cost. */
  feature: string;
  messages: AIMessage[];
  responseFormat?: AIResponseFormat;
  /** Lower than the feature's limit if you want shorter answers. */
  maxTokens?: number;
}

export interface AIChatResult {
  content: string;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  model: string;
  /** What was spent — pass it to refund() if your own processing of the answer fails. */
  charged: { resource: QuotaResource; amount: number };
  quota: QuotaSnapshot;
}

export type MoshlyErrorCode =
  | "insufficient_credits" // 402: not enough left this month (quota attached)
  | "no_subscription"      // 404: no Moshly plan for this user
  | "ai_unavailable"       // 503: the AI provider failed; credits were given back
  | "unavailable"          // moshly.io unreachable, misconfigured, or answered with something that isn't JSON
  | "bad_request";         // unknown feature / resource, invalid messages, etc. (a bug in the app)

/** Every failure. `message` is written for the end user (British English). */
export class MoshlyError extends Error {
  constructor(
    public readonly code: MoshlyErrorCode,
    message: string,
    public readonly status: number,
    public readonly quota?: QuotaSnapshot,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "MoshlyError";
  }
}

export interface MoshlyClientOptions {
  /** Short app id, sent as X-Moshly-App (e.g. "quote"). */
  appId: string;
  /** MOSHLY_APP_SECRET: per-app secret registered in moshly.io's KV. */
  appSecret: string;
  /** MOSHLY_HUB_URL, default https://moshly.io (http://localhost:8788 for local dev). */
  hubUrl?: string;
  /** Timeout for quota calls. AI calls get 120 s. */
  timeoutMs?: number;
}

const AI_TIMEOUT_MS = 120_000;

function formatDay(iso?: string): string {
  if (!iso) return "the start of next month";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

function userMessage(code: MoshlyErrorCode, resource?: QuotaResource, quota?: QuotaSnapshot): string {
  switch (code) {
    case "insufficient_credits":
      if (resource === "pdf_exports") {
        return quota?.limit === 0
          ? "PDF exports aren't included in your plan. Upgrade on Moshly to export PDFs."
          : `You've used all your PDF exports for this month. They renew on ${formatDay(quota?.resetsAt)}, or upgrade on Moshly.`;
      }
      return `You've run out of AI credits for this month. They renew on ${formatDay(quota?.resetsAt)}, or upgrade on Moshly.`;
    case "no_subscription":
      return "No Moshly plan was found for your account. Open Moshly to set one up.";
    case "ai_unavailable":
      return "The AI service is unavailable right now. Your credits were not used. Please try again later.";
    case "bad_request":
      return "Something went wrong with this request. Please try again.";
    default:
      return "Moshly couldn't be reached just now. Please try again in a moment.";
  }
}

export function createMoshlyClient(options: MoshlyClientOptions) {
  const hubUrl = (options.hubUrl || "https://moshly.io").replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? 8_000;
  const configured = Boolean(options.appSecret);

  function headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${options.appSecret}`,
      "X-Moshly-App": options.appId,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  async function request(method: "GET" | "POST", path: string, body: unknown, ms: number, resource?: QuotaResource) {
    if (!configured) {
      throw new MoshlyError("unavailable", userMessage("unavailable"), 0, undefined, "MOSHLY_APP_SECRET is not set");
    }
    let res: Response;
    try {
      res = await fetch(`${hubUrl}${path}`, {
        method,
        headers: headers(),
        body: method === "POST" ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(ms),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new MoshlyError("unavailable", userMessage("unavailable"), 0, undefined, detail);
    }
    const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
    const data = isJson ? ((await res.json().catch(() => null)) as Record<string, any> | null) : null;
    if (!data) {
      throw new MoshlyError("unavailable", userMessage("unavailable"), res.status, undefined, `non-JSON answer (${res.status})`);
    }
    if (res.ok) return data;

    const code: MoshlyErrorCode =
      res.status === 402 ? "insufficient_credits"
      : res.status === 404 && data.error === "no_subscription" ? "no_subscription"
      : res.status === 503 && data.error === "ai_unavailable" ? "ai_unavailable"
      : res.status === 400 ? "bad_request"
      : "unavailable";
    const quota = code === "insufficient_credits" ? (data as QuotaSnapshot) : undefined;
    throw new MoshlyError(code, userMessage(code, resource ?? quota?.resource, quota), res.status, quota, String(data.error ?? ""));
  }

  return {
    ai: {
      /** One AI call. Spends the feature's credits; throws MoshlyError (credits already refunded on ai_unavailable). */
      async chat(req: AIChatRequest): Promise<AIChatResult> {
        return (await request("POST", "/api/internal/ai/chat", req, AI_TIMEOUT_MS, "ai_credits")) as unknown as AIChatResult;
      },
    },

    quota: {
      /** This month's quotas and AI feature costs, or null if moshly.io can't be reached. */
      async overview(userId: string): Promise<QuotaOverview | null> {
        try {
          return (await request("GET", `/api/internal/quota/balance?userId=${encodeURIComponent(userId)}`, undefined, timeoutMs)) as unknown as QuotaOverview;
        } catch {
          return null;
        }
      },
      /** Spends quota for non-AI work (e.g. one PDF export). Call BEFORE the work; throws MoshlyError. */
      async consume(userId: string, resource: QuotaResource, amount = 1): Promise<QuotaSnapshot> {
        return (await request("POST", "/api/internal/quota/consume", { userId, resource, amount }, timeoutMs, resource)) as unknown as QuotaSnapshot;
      },
      /** Gives quota back after the paid work failed. Best effort: never throws. */
      async refund(userId: string, charged: { resource: QuotaResource; amount: number }): Promise<void> {
        try {
          await request("POST", "/api/internal/quota/refund", { userId, ...charged }, timeoutMs);
        } catch (err) {
          console.warn("[moshly] refund failed", { userId, ...charged, err: err instanceof Error ? err.message : err });
        }
      },
    },

    /** The message for the end user for any error (MoshlyError or not). */
    messageFor(err: unknown): string {
      return err instanceof MoshlyError ? err.message : userMessage("unavailable");
    },
  };
}

export type MoshlyClient = ReturnType<typeof createMoshlyClient>;
