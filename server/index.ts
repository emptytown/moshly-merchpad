import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { syncRouter } from "./sync.js";
import { SESSION_COOKIE, readSession, sessionSecret } from "./session.js";
import { getQuotaOverview } from "./hub.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOSHLY_SSO_VERIFY_URL =
  process.env.MOSHLY_SSO_VERIFY_URL ||
  "https://moshly.io/api/auth/sso/verify";

const SSO_VERIFY_TIMEOUT_MS = 5000;

const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Only Moshly may show MerchPad inside a frame (Browshly: moshly.io/app?app=merchpad).
  const frameAncestors = process.env.MOSHLY_FRAME_ANCESTORS || "https://moshly.io";
  app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${frameAncestors}`);
    next();
  });

  app.use(express.json());
  app.use(cookieParser(sessionSecret()));

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!readSession(req)) { res.status(401).json({ error: "no_session" }); return; }
    next();
  }

  app.use("/api/sync", requireAuth, syncRouter);

  // SSO callback: MerchPad receives token from Hub and validates it server-side
  app.post("/api/auth/moshly-verify", async (req, res) => {
    const { token } = req.body ?? {};
    if (!token) {
      res.status(400).json({ error: "missing_token" });
      return;
    }
    try {
      const hubRes = await fetch(MOSHLY_SSO_VERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(SSO_VERIFY_TIMEOUT_MS),
      });
      const data = (await hubRes.json()) as Record<string, unknown>;
      if (!hubRes.ok || !data.success) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      res.cookie(SESSION_COOKIE, JSON.stringify(data.user), {
        signed: true,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE,
      });
      res.json({ ok: true, user: data.user });
    } catch (err) {
      console.error("SSO verify error:", err);
      res.status(500).json({ error: "server_error" });
    }
  });

  // Session rehydration: returns the user from the session cookie
  app.get("/api/auth/me", (req, res) => {
    const user = readSession(req);
    if (!user) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    res.json({ user });
  });

  // This month's Moshly quotas (AI credits, PDF exports) for the signed-in user.
  // Before adding a paid feature: consumeQuota() before the work, refundQuota()
  // if it fails (see server/hub.ts).
  app.get("/api/quota", async (req, res) => {
    const user = readSession(req);
    if (!user) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    const overview = await getQuotaOverview(user.id);
    if (!overview) {
      res.status(503).json({ error: "quota_unavailable" });
      return;
    }
    res.json(overview);
  });

  // Sign out: clear session cookie
  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.json({ ok: true });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
