// ─── Production Server ───
//
// In dev, our backend lives inside `vite.config.ts`'s configureServer plugin.
// That plugin only runs in dev mode — `vite build` strips it out.
//
// This file is the production equivalent: a tiny Express app that:
//   1. Loads env vars from .env.local (in dev) or process.env (in prod / Render)
//   2. Mounts every existing API handler on its same /api/* path
//   3. Serves the built static frontend from dist/
//   4. Falls back to dist/index.html for SPA routes
//
// We keep the existing handler signatures (IncomingMessage, ServerResponse) —
// Express's req/res extend Node's, so they pass straight through.

import express, { type Request, type Response, type NextFunction } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Load .env.local in local dev (Render injects env vars natively) ─────
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0) {
      const k = trimmed.slice(0, eq);
      const v = trimmed.slice(eq + 1);
      // Don't overwrite real env vars (Render's take precedence)
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadEnvLocal();

// ─── Import every API handler ──────────────────────────────────────────
import {
  handleComplianceRequest,
  handleChatRequest,
  handleFeedbackRequest,
  handleProductFeedbackRequest,
  handleEventsRequest,
  handleHsClassifyRequest,
  handleAggregateRequest,
  handleLeadRequest,
  handleNotionHealthRequest,
} from "./server/complianceHandler";
import {
  handleTranslateRequest,
  handleDetectRequest,
  handleTtsRequest,
  handleAsrRequest,
} from "./server/sarvamService";
import { handleLabelAnalyzeRequest } from "./server/labelGuardHandler";
import { handleCrewRunRequest } from "./server/crewHandler";
import { initNotion } from "./server/notionService";

// ─── Build app ─────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// All handlers parse their own bodies via raw `req.on("data")` — no global
// body parser. Keep Express handlers thin: just adapt path → handler.
type Handler = (req: any, res: any) => unknown;
const route = (h: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(h(req, res)).catch(next);

app.post("/api/compliance",        route(handleComplianceRequest));
app.post("/api/chat",              route(handleChatRequest));
app.post("/api/feedback",          route(handleFeedbackRequest));
app.post("/api/product-feedback",  route(handleProductFeedbackRequest));
app.post("/api/events",            route(handleEventsRequest));
app.post("/api/hs-classify",       route(handleHsClassifyRequest));
app.post("/api/aggregate",         route(handleAggregateRequest));
app.post("/api/lead",              route(handleLeadRequest));
app.get("/api/notion-health",      route(handleNotionHealthRequest));
app.post("/api/notion-health",     route(handleNotionHealthRequest));
app.post("/api/sarvam/translate",  route(handleTranslateRequest));
app.post("/api/sarvam/detect",     route(handleDetectRequest));
app.post("/api/sarvam/tts",        route(handleTtsRequest));
app.post("/api/sarvam/asr",        route(handleAsrRequest));
app.post("/api/label-analyze",     route(handleLabelAnalyzeRequest));
app.post("/api/crew/run",          route(handleCrewRunRequest));

// ─── Static + SPA fallback ─────────────────────────────────────────────
const distDir = path.resolve(__dirname, "dist");
app.use(express.static(distDir));
// SPA fallback — Express 5 requires named splat (*splat), not bare *
app.get("/*splat", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

// ─── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[TradeSetu] Listening on http://0.0.0.0:${PORT}`);
  // Initialize Notion DBs on boot (fire-and-forget; safe if creds missing)
  initNotion().catch(() => { /* logged inside */ });
});
