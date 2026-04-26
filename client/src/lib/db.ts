/**
 * MerchPad IndexedDB Layer — v2
 * Design: Offline-first, append-only event log, two-tier stock model
 *
 * Stock tiers:
 *   warehouseStock  — master inventory (not sold from directly)
 *   roadStock       — working pool available to sessions & OneOff Sales
 *   currentStock    — alias for roadStock (backward compat, kept in sync)
 *
 * DB version 2 adds: warehouseStock, roadStock on ProductVariant;
 *                    oneoff_sale session type; stock_transferred audit action.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// ── Types ──────────────────────────────────────────────────────────────────

export type StockStatus = 'high' | 'medium' | 'low' | 'empty';

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  attributes: Record<string, string>;
  price: number;
  initialStock: number;   // set at "Start Sale" snapshot
  currentStock: number;   // alias for roadStock — decremented as sales happen
  warehouseStock: number; // master inventory (transfer → road to use)
  roadStock: number;      // on-the-road working pool
  imageUrl?: string;
}

export interface Product {
  id: string;
  projectId: string; // SCOPED
  name: string;
  category?: string;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface Show {
  id: string;
  projectId: string; // SCOPED
  name: string;
  venue: string;
  date: string;
  city?: string;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  createdAt: string;
}

export interface SaleSession {
  id: string;
  projectId: string; // SCOPED
  showId: string;           // 'oneoff' for OneOff Sales
  deviceId: string;
  repName: string;
  standName?: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'ended';
  sessionType: 'show' | 'oneoff';  // NEW
  stockSnapshot: Record<string, number>;
}

export interface TallyBatch {
  id: string;
  projectId: string; // SCOPED
  sessionId: string;
  showId: string;
  deviceId: string;
  repName: string;
  items: Array<{ variantId: string; variantName: string; qty: number; unitPrice: number }>;
  totalItems: number;
  totalPrice: number;
  confirmedAt: string;
  syncedAt?: string;
  status: 'pending' | 'synced' | 'voided';
  shortfallType?: 'discount' | 'seller_debt';
  shortfallAmount?: number;
  shortfallReason?: string;
  shortfallMemberId?: string;
}

export interface AuditEntry {
  id: string;
  projectId: string; // SCOPED
  sessionId: string;
  showId: string;
  deviceId: string;
  action:
    | 'tally_confirmed'
    | 'tally_voided'
    | 'stock_adjusted'
    | 'session_started'
    | 'session_ended'
    | 'tally_undo'
    | 'stock_transferred'
    | 'sale_discounted'
    | 'seller_debt_recorded';
  entityType: 'tally_batch' | 'product_variant' | 'session' | 'team_member';
  entityId: string;
  description: string;
  actorName: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  timestamp: string;
}

export interface StockAdjustment {
  id: string;
  projectId: string; // SCOPED
  variantId: string;
  variantName: string;
  sessionId: string;
  showId: string;
  delta: number;
  reason: 'damaged' | 'theft' | 'counting_error' | 'restock' | 'transfer_to_road' | 'transfer_to_warehouse' | 'other';
  notes?: string;
  adjustedBy: string;
  adjustedAt: string;
}

export interface SyncQueueItem {
  id: string;
  projectId: string; // SCOPED
  type: 'tally_batch' | 'stock_adjustment' | 'session_start' | 'session_end';
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  status: 'pending' | 'processing' | 'failed';
}

export interface AppSettings {
  key: string;       // composed: project_id:setting_key
  projectId: string; // SCOPED
  value: unknown;
}

export interface TeamMember {
  id: string;
  projectId: string; // SCOPED
  name: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  totalDebt?: number;
}

// ── DB Schema ──────────────────────────────────────────────────────────────

interface MerchPadDB extends DBSchema {
  products: { key: string; value: Product; indexes: { 'by-name': string; 'by-project': string } };
  shows: { key: string; value: Show; indexes: { 'by-date': string; 'by-status': string; 'by-project': string } };
  sessions: { key: string; value: SaleSession; indexes: { 'by-show': string; 'by-status': string; 'by-type': string; 'by-project': string } };
  tallyBatches: { key: string; value: TallyBatch; indexes: { 'by-session': string; 'by-show': string; 'by-status': string; 'by-project': string } };
  auditLog: { key: string; value: AuditEntry; indexes: { 'by-session': string; 'by-show': string; 'by-timestamp': string; 'by-project': string } };
  stockAdjustments: { key: string; value: StockAdjustment; indexes: { 'by-variant': string; 'by-session': string; 'by-project': string } };
  syncQueue: { key: string; value: SyncQueueItem; indexes: { 'by-status': string; 'by-project': string } };
  settings: { key: string; value: AppSettings; indexes: { 'by-project': string } };
  teamMembers: { key: string; value: TeamMember; indexes: { 'by-active': number; 'by-project': string } };
}

// ── DB Instance ────────────────────────────────────────────────────────────

let dbInstance: IDBPDatabase<MerchPadDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<MerchPadDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MerchPadDB>('merchpad', 4, {
    blocked() {
      console.warn('[MerchPad] DB upgrade blocked by another tab. Please close other tabs and reload.');
    },
    blocking() {
      // This tab is blocking an upgrade in another tab — close our connection
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      dbInstance = null;
    },
    upgrade(db, oldVersion, _newVersion, transaction) {
      // ── v1 → create all stores ─────────────────────────────────────────
      if (oldVersion < 1) {
        const products = db.createObjectStore('products', { keyPath: 'id' });
        products.createIndex('by-name', 'name');

        const shows = db.createObjectStore('shows', { keyPath: 'id' });
        shows.createIndex('by-date', 'date');
        shows.createIndex('by-status', 'status');

        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('by-show', 'showId');
        sessions.createIndex('by-status', 'status');

        const batches = db.createObjectStore('tallyBatches', { keyPath: 'id' });
        batches.createIndex('by-session', 'sessionId');
        batches.createIndex('by-show', 'showId');
        batches.createIndex('by-status', 'status');

        const audit = db.createObjectStore('auditLog', { keyPath: 'id' });
        audit.createIndex('by-session', 'sessionId');
        audit.createIndex('by-show', 'showId');
        audit.createIndex('by-timestamp', 'timestamp');

        const adjustments = db.createObjectStore('stockAdjustments', { keyPath: 'id' });
        adjustments.createIndex('by-variant', 'variantId');
        adjustments.createIndex('by-session', 'sessionId');

        const syncQueue = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncQueue.createIndex('by-status', 'status');

        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // ── v2 → add by-type index on sessions ────────────────────────────
      if (oldVersion < 2) {
        try {
          const sessionStore = transaction.objectStore('sessions');
          if (!sessionStore.indexNames.contains('by-type')) {
            sessionStore.createIndex('by-type', 'sessionType');
          }
        } catch { /* ignore */ }
      }

      // ── v3 → add teamMembers store ────────────────────────────────────
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('teamMembers')) {
          const team = db.createObjectStore('teamMembers', { keyPath: 'id' });
          team.createIndex('by-active', 'active');
        }
      }

      // ── v4 → add by-project indexes to ALL stores ─────────────────────
      if (oldVersion < 4) {
        const stores = [
          'products', 'shows', 'sessions', 'tallyBatches',
          'auditLog', 'stockAdjustments', 'syncQueue',
          'settings', 'teamMembers'
        ];
        stores.forEach(s => {
          try {
            const store = transaction.objectStore(s as any);
            if (!store.indexNames.contains('by-project')) {
              store.createIndex('by-project', 'projectId');
            }
          } catch { /* ignore */ }
        });
      }
    },
  });

  return dbInstance;
}

// ── Device ID ──────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  const key = 'mp_device_id';
  let id = localStorage.getItem(key);
  if (!id) { id = uuidv4(); localStorage.setItem(key, id); }
  return id;
}

// ── Settings helpers ───────────────────────────────────────────────────────

export async function getSetting<T>(projectId: string, key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const fullKey = `${projectId}:${key}`;
  const record = await db.get('settings', fullKey);
  return record ? (record.value as T) : defaultValue;
}

export async function setSetting(projectId: string, key: string, value: unknown): Promise<void> {
  const db = await getDB();
  const fullKey = `${projectId}:${key}`;
  await db.put('settings', { key: fullKey, projectId, value });
}

// ── Sync Queue ─────────────────────────────────────────────────────────────

export async function enqueueSync(projectId: string, type: SyncQueueItem['type'], payload: unknown): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', {
    id: uuidv4(), projectId, type, payload,
    createdAt: new Date().toISOString(), attempts: 0, status: 'pending',
  });
}

export async function getPendingSyncItems(projectId: string): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-project', projectId);
}

export async function markSyncItemDone(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

// ── Audit Log helpers ──────────────────────────────────────────────────────

export async function addAuditEntry(projectId: string, entry: Omit<AuditEntry, 'id' | 'projectId'>): Promise<void> {
  const db = await getDB();
  await db.put('auditLog', { id: uuidv4(), projectId, ...entry });
}

// ── Stock helpers ──────────────────────────────────────────────────────────

export function calcStockStatus(current: number, initial: number): StockStatus {
  if (initial <= 0) return 'empty';
  if (current <= 0) return 'empty';
  const pct = current / initial;
  if (pct > 0.3) return 'high';
  if (pct > 0.1) return 'medium';
  return 'low';
}

/** Migrate existing variants that lack warehouseStock / roadStock fields */
export async function migrateStockTiers(): Promise<void> {
  const db = await getDB();
  const products = await db.getAll('products');
  let migrated = false;
  for (const p of products) {
    let changed = false;
    const updated = {
      ...p,
      variants: p.variants.map(v => {
        if (v.warehouseStock === undefined || v.roadStock === undefined) {
          changed = true;
          return {
            ...v,
            warehouseStock: v.warehouseStock ?? 0,
            roadStock: v.roadStock ?? v.currentStock,
          };
        }
        return v;
      }),
    };
    if (changed) { await db.put('products', updated); migrated = true; }
  }
  if (migrated) console.info('[MerchPad] Migrated products to two-tier stock model');
}

// ── Seed demo data ─────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  const db = await getDB();
  const existing = await db.getAll('products');
  if (existing.length > 0) return;
  // NO-OP: seedDemoData is no longer called during boot.
  // Kept for reference or manual execution if needed.
  return;

  const now = new Date().toISOString();

  function makeVariant(
    productId: string,
    name: string,
    attributes: Record<string, string>,
    price: number,
    road: number,
    warehouse: number
  ): ProductVariant {
    return {
      id: uuidv4(), productId, name, attributes, price,
      initialStock: road, currentStock: road,
      warehouseStock: warehouse, roadStock: road,
    };
  }

  const products: Product[] = [
    {
      id: uuidv4(), name: 'T-Shirt', category: 'Apparel', createdAt: now, updatedAt: now,
      variants: [],
    },
    {
      id: uuidv4(), name: 'Poster', category: 'Print', createdAt: now, updatedAt: now,
      variants: [],
    },
    {
      id: uuidv4(), name: 'Vinyl Record', category: 'Music', createdAt: now, updatedAt: now,
      variants: [],
    },
    {
      id: uuidv4(), name: 'Enamel Pin', category: 'Accessories', createdAt: now, updatedAt: now,
      variants: [],
    },
    {
      id: uuidv4(), name: 'Hoodie', category: 'Apparel', createdAt: now, updatedAt: now,
      variants: [],
    },
  ];

  // T-Shirt variants
  products[0].variants = [
    makeVariant(products[0].id, 'T-Shirt Black M',  { color: 'Black', size: 'M' },  25, 20, 40),
    makeVariant(products[0].id, 'T-Shirt Black L',  { color: 'Black', size: 'L' },  25, 15, 30),
    makeVariant(products[0].id, 'T-Shirt Black XL', { color: 'Black', size: 'XL' }, 25, 10, 20),
    makeVariant(products[0].id, 'T-Shirt White M',  { color: 'White', size: 'M' },  25, 12, 24),
    makeVariant(products[0].id, 'T-Shirt White L',  { color: 'White', size: 'L' },  25,  8, 16),
  ];
  // Poster variants
  products[1].variants = [
    makeVariant(products[1].id, 'Poster A1', { size: 'A1' }, 15, 30, 60),
    makeVariant(products[1].id, 'Poster A2', { size: 'A2' }, 10, 25, 50),
  ];
  // Vinyl variants
  products[2].variants = [
    makeVariant(products[2].id, 'Vinyl LP Black',    { format: 'LP', color: 'Black' },    30, 15, 30),
    makeVariant(products[2].id, 'Vinyl LP Coloured', { format: 'LP', color: 'Coloured' }, 35,  8, 16),
  ];
  // Pin variants
  products[3].variants = [
    makeVariant(products[3].id, 'Pin Logo', { design: 'Logo' }, 8, 50, 100),
    makeVariant(products[3].id, 'Pin Tour', { design: 'Tour' }, 8, 40,  80),
  ];
  // Hoodie variants
  products[4].variants = [
    makeVariant(products[4].id, 'Hoodie Black M', { color: 'Black', size: 'M' }, 55, 6, 12),
    makeVariant(products[4].id, 'Hoodie Black L', { color: 'Black', size: 'L' }, 55, 4,  8),
  ];

  for (const p of products) await db.put('products', p);

  const shows: Show[] = [
    {
      id: uuidv4(), name: 'Summer Solstice Tour', venue: 'Altice Arena',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      city: 'Lisbon', status: 'upcoming', createdAt: now,
    },
    {
      id: uuidv4(), name: 'NOS Alive 2026', venue: 'Passeio Marítimo de Algés',
      date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
      city: 'Lisbon', status: 'completed', createdAt: now,
    },
  ];
  for (const s of shows) await db.put('shows', s);
}

// ── Danger Zone Operations ────────────────────────────────────────────────

export async function resetAllStock(projectId: string): Promise<void> {
  const db = await getDB();
  const products = await db.getAllFromIndex('products', 'by-project', projectId);
  for (const product of products) {
    const updated = {
      ...product,
      variants: product.variants.map(v => ({
        ...v,
        currentStock: v.initialStock,
        roadStock: v.initialStock,
      })),
      updatedAt: new Date().toISOString(),
    };
    await db.put('products', updated);
  }
}

export async function deleteAllProducts(projectId: string): Promise<void> {
  const db = await getDB();
  const products = await db.getAllFromIndex('products', 'by-project', projectId);
  for (const p of products) await db.delete('products', p.id);
}

export async function deleteProjectData(projectId: string): Promise<void> {
  const db = await getDB();
  const stores = ['products', 'shows', 'sessions', 'tallyBatches', 'auditLog', 'stockAdjustments', 'syncQueue', 'settings', 'teamMembers'] as const;

  for (const s of stores) {
    const items = await db.getAllFromIndex(s as any, 'by-project', projectId);
    for (const item of items) {
      await db.delete(s as any, (item as any).id || (item as any).key);
    }
  }
}

export async function resetAndDeleteAll(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('products'), db.clear('shows'), db.clear('sessions'),
    db.clear('tallyBatches'), db.clear('auditLog'),
    db.clear('stockAdjustments'), db.clear('syncQueue'), db.clear('settings'),
    db.clear('teamMembers'),
  ]);
  localStorage.removeItem('mp_projects');
  localStorage.removeItem('mp_active_project_id');
  localStorage.removeItem('mp_device_id');
}

export async function removeMockData(projectId: string): Promise<void> {
  const MOCK_PRODUCT_NAMES = ['T-Shirt', 'Poster', 'Vinyl Record', 'Enamel Pin', 'Hoodie'];
  const MOCK_SHOW_NAMES = ['Summer Solstice Tour', 'NOS Alive 2026'];
  const db = await getDB();

  const products = await db.getAllFromIndex('products', 'by-project', projectId);
  for (const p of products) {
    if (MOCK_PRODUCT_NAMES.includes(p.name)) await db.delete('products', p.id);
  }

  const shows = await db.getAllFromIndex('shows', 'by-project', projectId);
  for (const s of shows) {
    if (MOCK_SHOW_NAMES.includes(s.name)) await db.delete('shows', s.id);
  }
}

export async function hasProducts(projectId: string): Promise<boolean> {
  const db = await getDB();
  const products = await db.getAllFromIndex('products', 'by-project', projectId);
  return products.length > 0;
}
