// MerchPad session: the Moshly user (from SSO) in a signed, httpOnly cookie.
// The cookie decides whose data is synced and whose Moshly quota is spent, so
// the browser must not be able to edit it.
import { createHash, randomBytes } from "crypto";
import type { Request } from "express";

export const SESSION_COOKIE = "mp_session";

export interface SessionUser {
  id: string; // Moshly user id
  email?: string;
  name?: string;
  role?: string;
  plan?: string;
}

/**
 * Key for signing the session cookie. SESSION_SECRET if set; otherwise derived
 * from SUPABASE_SERVICE_ROLE_KEY (already a server-only secret here), so no new
 * variable is needed to deploy. In local dev without either, a per-process key
 * (sessions end on restart).
 */
export function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createHash("sha256").update(`merchpad-session:${process.env.SUPABASE_SERVICE_ROLE_KEY}`).digest("hex");
  }
  if (process.env.NODE_ENV === "production") {
    console.error("[session] SESSION_SECRET is not set: sessions won't survive a restart");
  }
  return randomBytes(32).toString("hex");
}

/** The signed-in user, or null (no cookie, unsigned/edited cookie, bad JSON). */
export function readSession(req: Request): SessionUser | null {
  const raw = req.signedCookies?.[SESSION_COOKIE];
  if (typeof raw !== "string") return null;
  try {
    const user = JSON.parse(raw) as SessionUser;
    return typeof user?.id === "string" && user.id.length > 0 ? user : null;
  } catch {
    return null;
  }
}
