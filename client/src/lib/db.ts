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
  name: string;
  category?: string;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface Show {
  id: string;
  name: string;
  venue: string;
  date: string;
  city?: string;
  status: 'upcoming' | 'active' | 'completed';
  createdAt: string;
}

export interface SaleSession {
  id: string;
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
}

export interface AuditEntry {
  id: string;
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
    | 'stock_transferred';   // NEW — warehouse → road transfer
  entityType: 'tally_batch' | 'product_variant' | 'session';
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
  type: 'tally_batch' | 'stock_adjustment' | 'session_start' | 'session_end';
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  status: 'pending' | 'processing' | 'failed';
}

export interface AppSettings {
  key: string;
  value: unknown;
}

// ── DB Schema ──────────────────────────────────────────────────────────────

interface MerchPadDB extends DBSchema {
  products: { key: string; value: Product; indexes: { 'by-name': string } };
  shows: { key: string; value: Show; indexes: { 'by-date': string; 'by-status': string } };
  sessions: { key: string; value: SaleSession; indexes: { 'by-show': string; 'by-status': string; 'by-type': string } };
  tallyBatches: { key: string; value: TallyBatch; indexes: { 'by-session': string; 'by-show': string; 'by-status': string } };
  auditLog: { key: string; value: AuditEntry; indexes: { 'by-session': string; 'by-show': string; 'by-timestamp': string } };
  stockAdjustments: { key: string; value: StockAdjustment; indexes: { 'by-variant': string; 'by-session': string } };
  syncQueue: { key: string; value: SyncQueueItem; indexes: { 'by-status': string } };
  settings: { key: string; value: AppSettings };
}

// ── DB Instance ────────────────────────────────────────────────────────────

let dbInstance: IDBPDatabase<MerchPadDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<MerchPadDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MerchPadDB>('merchpad', 2, {
    upgrade(db, oldVersion) {
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
      // (warehouseStock / roadStock are added in-place on product records
      //  via the boot migration in MerchPadContext; no schema change needed)
      if (oldVersion < 2) {
        // sessions store already exists from v1; add the new index
        // The upgrade transaction is available via the IDBPDatabase upgrade callback
        // We check if the index already exists to avoid duplicate creation
        const tx = db as unknown as { transaction: { objectStore: (name: string) => IDBObjectStore } };
        try {
          const sessionStore = tx.transaction.objectStore('sessions');
          if (!sessionStore.indexNames.contains('by-type')) {
            sessionStore.createIndex('by-type', 'sessionType');
          }
        } catch {
          // Index creation may fail if store doesn't exist yet (handled by v1 block)
        }
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

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record ? (record.value as T) : defaultValue;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

// ── Sync Queue ─────────────────────────────────────────────────────────────

export async function enqueueSync(type: SyncQueueItem['type'], payload: unknown): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', {
    id: uuidv4(), type, payload,
    createdAt: new Date().toISOString(), attempts: 0, status: 'pending',
  });
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
}

export async function markSyncItemDone(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

// ── Audit Log helpers ──────────────────────────────────────────────────────

export async function addAuditEntry(entry: Omit<AuditEntry, 'id'>): Promise<void> {
  const db = await getDB();
  await db.put('auditLog', { id: uuidv4(), ...entry });
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

export async function resetAllStock(): Promise<void> {
  const db = await getDB();
  const products = await db.getAll('products');
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

export async function deleteAllProducts(): Promise<void> {
  const db = await getDB();
  await db.clear('products');
}

export async function deleteProjectData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('products'), db.clear('shows'), db.clear('sessions'),
    db.clear('tallyBatches'), db.clear('auditLog'),
    db.clear('stockAdjustments'), db.clear('syncQueue'),
  ]);
}

export async function resetAndDeleteAll(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('products'), db.clear('shows'), db.clear('sessions'),
    db.clear('tallyBatches'), db.clear('auditLog'),
    db.clear('stockAdjustments'), db.clear('syncQueue'), db.clear('settings'),
  ]);
  localStorage.removeItem('mp_projects');
  localStorage.removeItem('mp_active_project_id');
  localStorage.removeItem('mp_device_id');
}

export async function removeMockData(): Promise<void> {
  const MOCK_PRODUCT_NAMES = ['T-Shirt', 'Poster', 'Vinyl Record', 'Enamel Pin', 'Hoodie'];
  const MOCK_SHOW_NAMES = ['Summer Solstice Tour', 'NOS Alive 2026'];
  const db = await getDB();
  const products = await db.getAll('products');
  for (const p of products) {
    if (MOCK_PRODUCT_NAMES.includes(p.name)) await db.delete('products', p.id);
  }
  const shows = await db.getAll('shows');
  for (const s of shows) {
    if (MOCK_SHOW_NAMES.includes(s.name)) await db.delete('shows', s.id);
  }
}
