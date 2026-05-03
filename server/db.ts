import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Types (mirror of client-side interfaces)
// ---------------------------------------------------------------------------

export interface SyncItem {
  id: string;
  projectId: string;
  type:
    | "tally_batch"
    | "stock_adjustment"
    | "session_start"
    | "session_end"
    | "product_upsert"
    | "show_upsert"
    | "team_member_upsert"
    | "settings_update"
    | "product_delete"
    | "show_delete"
    | "team_member_delete";
  payload: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Upsert helpers — each returns the processed item id on success
// ---------------------------------------------------------------------------

export async function upsertSession(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;
  const retentionDays = await getRetentionDays(userId, item.projectId);
  const expiresAt = computeExpiresAt(item.createdAt, retentionDays);

  const { error } = await supabase.from("sale_sessions").upsert(
    {
      id: item.id,
      user_id: userId,
      project_id: item.projectId,
      show_id: p.showId,
      device_id: p.deviceId,
      rep_name: p.repName,
      stand_name: p.standName ?? null,
      session_type: p.sessionType ?? "show",
      status: p.status,
      stock_snapshot: p.stockSnapshot ?? {},
      started_at: p.startedAt,
      ended_at: p.endedAt ?? null,
      expires_at: expiresAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`upsertSession failed: ${error.message}`);
  return item.id;
}

export async function upsertTallyBatch(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;
  const retentionDays = await getRetentionDays(userId, item.projectId);
  const expiresAt = computeExpiresAt(item.createdAt, retentionDays);

  const { error } = await supabase.from("tally_batches").upsert(
    {
      id: item.id,
      user_id: userId,
      project_id: item.projectId,
      session_id: p.sessionId,
      show_id: p.showId,
      device_id: p.deviceId,
      rep_name: p.repName,
      items: p.items ?? [],
      total_items: p.totalItems,
      total_price: p.totalPrice,
      status: p.status,
      shortfall_type: p.shortfallType ?? null,
      shortfall_amount: p.shortfallAmount ?? null,
      shortfall_reason: p.shortfallReason ?? null,
      shortfall_member_id: p.shortfallMemberId ?? null,
      confirmed_at: p.confirmedAt,
      expires_at: expiresAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`upsertTallyBatch failed: ${error.message}`);
  return item.id;
}

export async function upsertStockAdjustment(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;
  const retentionDays = await getRetentionDays(userId, item.projectId);
  const expiresAt = computeExpiresAt(item.createdAt, retentionDays);

  const { error } = await supabase.from("stock_adjustments").upsert(
    {
      id: item.id,
      user_id: userId,
      project_id: item.projectId,
      variant_id: p.variantId,
      variant_name: p.variantName,
      session_id: p.sessionId,
      show_id: p.showId,
      delta: p.delta,
      reason: p.reason,
      notes: p.notes ?? null,
      adjusted_by: p.adjustedBy,
      adjusted_at: p.adjustedAt,
      expires_at: expiresAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`upsertStockAdjustment failed: ${error.message}`);
  return item.id;
}

export async function upsertProduct(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;

  const { error } = await supabase.from("products").upsert(
    {
      id: p.id as string,
      user_id: userId,
      project_id: item.projectId,
      name: p.name,
      description: p.description ?? null,
      category: p.category ?? null,
      status: p.status ?? "active",
      variants: p.variants ?? [],
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`upsertProduct failed: ${error.message}`);
  return item.id;
}

export async function deleteProduct(
  userId: string,
  item: SyncItem
): Promise<string> {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", item.payload.id as string)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteProduct failed: ${error.message}`);
  return item.id;
}

export async function upsertShow(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;

  const { error } = await supabase.from("shows").upsert(
    {
      id: p.id as string,
      user_id: userId,
      project_id: item.projectId,
      name: p.name,
      venue: p.venue,
      date: p.date,
      city: p.city ?? null,
      status: p.status,
      created_at: p.createdAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`upsertShow failed: ${error.message}`);
  return item.id;
}

export async function deleteShow(
  userId: string,
  item: SyncItem
): Promise<string> {
  const { error } = await supabase
    .from("shows")
    .delete()
    .eq("id", item.payload.id as string)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteShow failed: ${error.message}`);
  return item.id;
}

export async function upsertTeamMember(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;

  const { error } = await supabase.from("team_members").upsert(
    {
      id: p.id as string,
      user_id: userId,
      project_id: item.projectId,
      name: p.name,
      phone: p.phone ?? null,
      email: p.email ?? null,
      active: p.active ?? true,
      total_debt: p.totalDebt ?? null,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`upsertTeamMember failed: ${error.message}`);
  return item.id;
}

export async function deleteTeamMember(
  userId: string,
  item: SyncItem
): Promise<string> {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", item.payload.id as string)
    .eq("user_id", userId);

  if (error) throw new Error(`deleteTeamMember failed: ${error.message}`);
  return item.id;
}

export async function upsertSettings(
  userId: string,
  item: SyncItem
): Promise<string> {
  const p = item.payload;

  const { error } = await supabase.from("settings").upsert(
    {
      key: p.key as string,
      user_id: userId,
      project_id: item.projectId,
      value: p.value,
    },
    { onConflict: "key,user_id,project_id" }
  );

  if (error) throw new Error(`upsertSettings failed: ${error.message}`);
  return item.id;
}

// ---------------------------------------------------------------------------
// Restore — returns all data for a project
// ---------------------------------------------------------------------------

export async function restoreProject(userId: string, projectId: string) {
  const [products, shows, sessions, tallyBatches, stockAdjustments, teamMembers, settings] =
    await Promise.all([
      supabase.from("products").select("*").eq("user_id", userId).eq("project_id", projectId),
      supabase.from("shows").select("*").eq("user_id", userId).eq("project_id", projectId),
      supabase.from("sale_sessions").select("*").eq("user_id", userId).eq("project_id", projectId),
      supabase.from("tally_batches").select("*").eq("user_id", userId).eq("project_id", projectId),
      supabase.from("stock_adjustments").select("*").eq("user_id", userId).eq("project_id", projectId),
      supabase.from("team_members").select("*").eq("user_id", userId).eq("project_id", projectId),
      supabase.from("settings").select("*").eq("user_id", userId).eq("project_id", projectId),
    ]);

  return {
    products: products.data ?? [],
    shows: shows.data ?? [],
    sessions: sessions.data ?? [],
    tallyBatches: tallyBatches.data ?? [],
    stockAdjustments: stockAdjustments.data ?? [],
    teamMembers: teamMembers.data ?? [],
    settings: settings.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Cleanup — deletes expired rows for a project
// ---------------------------------------------------------------------------

export async function cleanupExpiredRows(
  userId: string,
  projectId: string
): Promise<void> {
  const now = new Date().toISOString();
  const tables = ["sale_sessions", "tally_batches", "stock_adjustments", "audit_log"] as const;

  await Promise.all(
    tables.map((table) =>
      supabase
        .from(table)
        .delete()
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .lt("expires_at", now)
    )
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_RETENTION_DAYS = 365;

async function getRetentionDays(userId: string, projectId: string): Promise<number> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "retention_days")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) return DEFAULT_RETENTION_DAYS;
  const val = Number((data.value as Record<string, unknown>)?.days ?? DEFAULT_RETENTION_DAYS);
  return Number.isFinite(val) && val > 0 ? val : DEFAULT_RETENTION_DAYS;
}

function computeExpiresAt(createdAt: string, retentionDays: number): string {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + retentionDays);
  return date.toISOString();
}
