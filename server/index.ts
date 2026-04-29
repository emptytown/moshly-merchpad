import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOSHLY_SSO_VERIFY_URL =
  process.env.MOSHLY_SSO_VERIFY_URL ||
  "https://moshly.io/api/auth/sso/verify";

const SESSION_COOKIE = "mp_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());
  app.use(cookieParser());

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) { res.status(401).json({ error: "no_session" }); return; }
    try { JSON.parse(raw); next(); } catch { res.status(401).json({ error: "invalid_session" }); }
  }

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
      });
      const data = (await hubRes.json()) as Record<string, unknown>;
      if (!hubRes.ok || !data.success) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }
      res.cookie(SESSION_COOKIE, JSON.stringify(data.user), {
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
    const raw = req.cookies?.[SESSION_COOKIE];
    if (!raw) {
      res.status(401).json({ error: "no_session" });
      return;
    }
    try {
      res.json({ user: JSON.parse(raw) });
    } catch {
      res.status(401).json({ error: "invalid_session" });
    }
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
