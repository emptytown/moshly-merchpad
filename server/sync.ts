import { Router } from "express";
import {
  SyncItem,
  cleanupExpiredRows,
  deleteProduct,
  deleteShow,
  deleteTeamMember,
  restoreProject,
  upsertProduct,
  upsertSession,
  upsertSettings,
  upsertShow,
  upsertStockAdjustment,
  upsertTallyBatch,
  upsertTeamMember,
} from "./db.js";

const MAX_BATCH_SIZE = 100;

export const syncRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/sync/batch
// Receives up to MAX_BATCH_SIZE sync items, processes each, returns processed ids.
// ---------------------------------------------------------------------------

syncRouter.post("/batch", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "no_session" });
    return;
  }

  const { items } = req.body as { items?: unknown[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items must be a non-empty array" });
    return;
  }
  if (items.length > MAX_BATCH_SIZE) {
    res.status(400).json({ error: `batch size exceeds limit of ${MAX_BATCH_SIZE}` });
    return;
  }

  const processed: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const raw of items) {
    const item = validateSyncItem(raw);
    if (!item) {
      failed.push({ id: String((raw as Record<string, unknown>)?.id ?? "unknown"), error: "invalid_item" });
      continue;
    }

    try {
      const processedId = await dispatchSyncItem(userId, item);
      processed.push(processedId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      failed.push({ id: item.id, error: message });
    }
  }

  // Cleanup expired rows for each unique project in this batch (best-effort)
  const projectIdSet = new Set(items.map((i) => (i as Record<string, unknown>)?.projectId as string).filter(Boolean));
  await Promise.allSettled(Array.from(projectIdSet).map((pid) => cleanupExpiredRows(userId, pid)));

  res.json({ processed, failed });
});

// ---------------------------------------------------------------------------
// GET /api/sync/restore/:projectId
// Returns all data for the authenticated user's project (used on new device).
// ---------------------------------------------------------------------------

syncRouter.get("/restore/:projectId", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "no_session" });
    return;
  }

  const { projectId } = req.params;
  if (!projectId || typeof projectId !== "string") {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  try {
    const data = await restoreProject(userId, projectId);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/sync/cleanup/:projectId
// Manually trigger cleanup of expired rows for a project.
// ---------------------------------------------------------------------------

syncRouter.delete("/cleanup/:projectId", async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "no_session" });
    return;
  }

  const { projectId } = req.params;
  if (!projectId || typeof projectId !== "string") {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  try {
    await cleanupExpiredRows(userId, projectId);
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    res.status(500).json({ error: message });
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserId(req: import("express").Request): string | null {
  try {
    const raw = req.cookies?.["mp_session"] as string | undefined;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed.id === "string" && parsed.id.length > 0 ? parsed.id : null;
  } catch {
    return null;
  }
}

function validateSyncItem(raw: unknown): SyncItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.projectId !== "string" ||
    typeof item.type !== "string" ||
    typeof item.createdAt !== "string" ||
    !item.payload ||
    typeof item.payload !== "object"
  ) {
    return null;
  }

  const validTypes: SyncItem["type"][] = [
    "tally_batch",
    "stock_adjustment",
    "session_start",
    "session_end",
    "product_upsert",
    "show_upsert",
    "team_member_upsert",
    "settings_update",
    "product_delete",
    "show_delete",
    "team_member_delete",
  ];

  if (!validTypes.includes(item.type as SyncItem["type"])) return null;

  return item as unknown as SyncItem;
}

async function dispatchSyncItem(userId: string, item: SyncItem): Promise<string> {
  switch (item.type) {
    case "session_start":
    case "session_end":
      return upsertSession(userId, item);
    case "tally_batch":
      return upsertTallyBatch(userId, item);
    case "stock_adjustment":
      return upsertStockAdjustment(userId, item);
    case "product_upsert":
      return upsertProduct(userId, item);
    case "product_delete":
      return deleteProduct(userId, item);
    case "show_upsert":
      return upsertShow(userId, item);
    case "show_delete":
      return deleteShow(userId, item);
    case "team_member_upsert":
      return upsertTeamMember(userId, item);
    case "team_member_delete":
      return deleteTeamMember(userId, item);
    case "settings_update":
      return upsertSettings(userId, item);
  }
}
