import { getDB } from './db';
import type { Product, Show, SaleSession, TallyBatch, StockAdjustment, TeamMember } from './db';

// ---------------------------------------------------------------------------
// Types returned by Supabase (snake_case columns)
// ---------------------------------------------------------------------------

interface DbSession {
  id: string; project_id: string; show_id: string; device_id: string;
  rep_name: string; stand_name?: string; session_type: string; status: string;
  stock_snapshot: Record<string, number>; started_at: string; ended_at?: string;
}

interface DbTallyBatch {
  id: string; project_id: string; session_id: string; show_id: string;
  device_id: string; rep_name: string; items: TallyBatch['items'];
  total_items: number; total_price: number; status: string;
  shortfall_type?: string; shortfall_amount?: number; shortfall_reason?: string;
  shortfall_member_id?: string; confirmed_at: string;
}

interface DbStockAdjustment {
  id: string; project_id: string; variant_id: string; variant_name: string;
  session_id: string; show_id: string; delta: number; reason: string;
  notes?: string; adjusted_by: string; adjusted_at: string;
}

interface DbTeamMember {
  id: string; project_id: string; name: string; phone?: string; email?: string;
  active: boolean; total_debt?: number; created_at: string; updated_at: string;
}

interface DbProduct {
  id: string; project_id: string; name: string; description?: string;
  category?: string; status?: string; variants: Product['variants'];
  created_at: string; updated_at: string;
}

interface DbShow {
  id: string; project_id: string; name: string; venue: string; date: string;
  city?: string; status: string; created_at: string;
}

interface RestorePayload {
  products: DbProduct[];
  shows: DbShow[];
  sessions: DbSession[];
  tallyBatches: DbTallyBatch[];
  stockAdjustments: DbStockAdjustment[];
  teamMembers: DbTeamMember[];
}

// ---------------------------------------------------------------------------
// Main restore function
// ---------------------------------------------------------------------------

export async function restoreProjectFromServer(projectId: string): Promise<boolean> {
  if (!navigator.onLine) return false;

  let payload: RestorePayload;

  try {
    const res = await fetch(`/api/sync/restore/${encodeURIComponent(projectId)}`, {
      credentials: 'include',
    });
    if (!res.ok) return false;
    payload = (await res.json()) as RestorePayload;
  } catch {
    return false;
  }

  const db = await getDB();

  const writes: Promise<unknown>[] = [];

  for (const row of payload.products) {
    writes.push(db.put('products', mapProduct(row)));
  }
  for (const row of payload.shows) {
    writes.push(db.put('shows', mapShow(row)));
  }
  for (const row of payload.sessions) {
    writes.push(db.put('sessions', mapSession(row)));
  }
  for (const row of payload.tallyBatches) {
    writes.push(db.put('tallyBatches', mapTallyBatch(row)));
  }
  for (const row of payload.stockAdjustments) {
    writes.push(db.put('stockAdjustments', mapStockAdjustment(row)));
  }
  for (const row of payload.teamMembers) {
    writes.push(db.put('teamMembers', mapTeamMember(row)));
  }

  await Promise.all(writes);
  return true;
}

// ---------------------------------------------------------------------------
// Mappers — snake_case DB → camelCase client interfaces
// ---------------------------------------------------------------------------

function mapProduct(r: DbProduct): Product {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    description: r.description,
    category: r.category,
    status: (r.status ?? 'active') as Product['status'],
    variants: r.variants,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapShow(r: DbShow): Show {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    venue: r.venue,
    date: r.date,
    city: r.city,
    status: r.status as Show['status'],
    createdAt: r.created_at,
  };
}

function mapSession(r: DbSession): SaleSession {
  return {
    id: r.id,
    projectId: r.project_id,
    showId: r.show_id,
    deviceId: r.device_id,
    repName: r.rep_name,
    standName: r.stand_name,
    sessionType: r.session_type as SaleSession['sessionType'],
    status: r.status as SaleSession['status'],
    stockSnapshot: r.stock_snapshot,
    startedAt: r.started_at,
    endedAt: r.ended_at,
  };
}

function mapTallyBatch(r: DbTallyBatch): TallyBatch {
  return {
    id: r.id,
    projectId: r.project_id,
    sessionId: r.session_id,
    showId: r.show_id,
    deviceId: r.device_id,
    repName: r.rep_name,
    items: r.items,
    totalItems: r.total_items,
    totalPrice: r.total_price,
    status: r.status as TallyBatch['status'],
    shortfallType: r.shortfall_type as TallyBatch['shortfallType'],
    shortfallAmount: r.shortfall_amount,
    shortfallReason: r.shortfall_reason,
    shortfallMemberId: r.shortfall_member_id,
    confirmedAt: r.confirmed_at,
  };
}

function mapStockAdjustment(r: DbStockAdjustment): StockAdjustment {
  return {
    id: r.id,
    projectId: r.project_id,
    variantId: r.variant_id,
    variantName: r.variant_name,
    sessionId: r.session_id,
    showId: r.show_id,
    delta: r.delta,
    reason: r.reason as StockAdjustment['reason'],
    notes: r.notes,
    adjustedBy: r.adjusted_by,
    adjustedAt: r.adjusted_at,
  };
}

function mapTeamMember(r: DbTeamMember): TeamMember {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    active: r.active,
    totalDebt: r.total_debt,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
