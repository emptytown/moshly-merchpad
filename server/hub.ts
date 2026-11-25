// MerchPad ↔ moshly.io: AI and quotas through the shared Moshly client
// (server/_vendor/moshly.ts, vendored from emptytown/moshly-modules MoshlyAI).
// MerchPad holds no AI provider key. To add an AI feature: register
// "merchpad.<action>" with its credit cost on moshly.io (functions/api/_ai.js),
// then call moshly.ai.chat({ userId, feature, messages }) — userId is the
// Moshly user id from the session (readSession(req).id).
import { createMoshlyClient } from "./_vendor/moshly.js";

export const moshly = createMoshlyClient({
  appId: "merchpad",
  appSecret: process.env.MOSHLY_APP_SECRET ?? "",
  hubUrl: process.env.MOSHLY_HUB_URL,
});

/** This month's quotas and AI feature costs, or null if moshly.io can't be reached. */
export const getQuotaOverview = (userId: string) => moshly.quota.overview(userId);
