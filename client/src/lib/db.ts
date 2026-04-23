/**
 * MerchPad IndexedDB Layer
 * Design: Offline-first, append-only event log, snapshot-based stock
 * All data lives here until synced to backend (Cloudflare D1)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v4 as uuidv4 } from 'uuid';

// ── Types ──────────────────────────────────────────────────────────────────

export type StockStatus = 'high' | 'medium' | 'low' | 'empty';

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;          // e.g. "T-Shirt Black M"
  sku?: string;
  attributes: Record<string, string>; // { color: 'black', size: 'M' }
  price: number;
  initialStock: number;  // set at "Start Sale" snapshot
  currentStock: number;  // decremented locally as sales happen
  imageUrl?: string;
}

export interface Product {
  id: string;
  name: string;          // e.g. "T-Shirt"
  category?: string;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface Show {
  id: string;
  name: string;
  venue: string;
  date: string;          // ISO date string
  city?: string;
  status: 'upcoming' | 'active' | 'completed';
  createdAt: string;
}

export interface SaleSession {
  id: string;
  showId: string;
  deviceId: string;
  repName: string;
  standName?: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'ended';
  // Stock snapshot at session start (variantId → allocatedQty)
  stockSnapshot: Record<string, number>;
}

export interface TallyBatch {
  id: string;            // client-generated UUIDv4 (idempotency key)
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
  action: 'tally_confirmed' | 'tally_voided' | 'stock_adjusted' | 'session_started' | 'session_ended' | 'tally_undo';
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
  delta: number;         // positive = restock, negative = reduction
  reason: 'damaged' | 'theft' | 'counting_error' | 'restock' | 'other';
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
  products: {
    key: string;
    value: Product;
    indexes: { 'by-name': string };
  };
  shows: {
    key: string;
    value: Show;
    indexes: { 'by-date': string; 'by-status': string };
  };
  sessions: {
    key: string;
    value: SaleSession;
    indexes: { 'by-show': string; 'by-status': string };
  };
  tallyBatches: {
    key: string;
    value: TallyBatch;
    indexes: { 'by-session': string; 'by-show': string; 'by-status': string };
  };
  auditLog: {
    key: string;
    value: AuditEntry;
    indexes: { 'by-session': string; 'by-show': string; 'by-timestamp': string };
  };
  stockAdjustments: {
    key: string;
    value: StockAdjustment;
    indexes: { 'by-variant': string; 'by-session': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

// ── DB Instance ────────────────────────────────────────────────────────────

let dbInstance: IDBPDatabase<MerchPadDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<MerchPadDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MerchPadDB>('merchpad', 1, {
    upgrade(db) {
      // Products
      const products = db.createObjectStore('products', { keyPath: 'id' });
      products.createIndex('by-name', 'name');

      // Shows
      const shows = db.createObjectStore('shows', { keyPath: 'id' });
      shows.createIndex('by-date', 'date');
      shows.createIndex('by-status', 'status');

      // Sessions
      const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
      sessions.createIndex('by-show', 'showId');
      sessions.createIndex('by-status', 'status');

      // Tally Batches
      const batches = db.createObjectStore('tallyBatches', { keyPath: 'id' });
      batches.createIndex('by-session', 'sessionId');
      batches.createIndex('by-show', 'showId');
      batches.createIndex('by-status', 'status');

      // Audit Log
      const audit = db.createObjectStore('auditLog', { keyPath: 'id' });
      audit.createIndex('by-session', 'sessionId');
      audit.createIndex('by-show', 'showId');
      audit.createIndex('by-timestamp', 'timestamp');

      // Stock Adjustments
      const adjustments = db.createObjectStore('stockAdjustments', { keyPath: 'id' });
      adjustments.createIndex('by-variant', 'variantId');
      adjustments.createIndex('by-session', 'sessionId');

      // Sync Queue
      const syncQueue = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncQueue.createIndex('by-status', 'status');

      // Settings
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });

  return dbInstance;
}

// ── Device ID ──────────────────────────────────────────────────────────────

export function getDeviceId(): string {
  const key = 'mp_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(key, id);
  }
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

export async function enqueueSync(
  type: SyncQueueItem['type'],
  payload: unknown
): Promise<void> {
  const db = await getDB();
  const item: SyncQueueItem = {
    id: uuidv4(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  };
  await db.put('syncQueue', item);
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

export async function addAuditEntry(
  entry: Omit<AuditEntry, 'id'>
): Promise<void> {
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

// ── Seed demo data ─────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  const db = await getDB();

  // Check if already seeded
  const existing = await db.getAll('products');
  if (existing.length > 0) return;

  const now = new Date().toISOString();

  const products: Product[] = [
    {
      id: uuidv4(),
      name: 'T-Shirt',
      category: 'Apparel',
      variants: [
        { id: uuidv4(), productId: '', name: 'T-Shirt Black M', attributes: { color: 'Black', size: 'M' }, price: 25, initialStock: 20, currentStock: 20 },
        { id: uuidv4(), productId: '', name: 'T-Shirt Black L', attributes: { color: 'Black', size: 'L' }, price: 25, initialStock: 15, currentStock: 15 },
        { id: uuidv4(), productId: '', name: 'T-Shirt Black XL', attributes: { color: 'Black', size: 'XL' }, price: 25, initialStock: 10, currentStock: 10 },
        { id: uuidv4(), productId: '', name: 'T-Shirt White M', attributes: { color: 'White', size: 'M' }, price: 25, initialStock: 12, currentStock: 12 },
        { id: uuidv4(), productId: '', name: 'T-Shirt White L', attributes: { color: 'White', size: 'L' }, price: 25, initialStock: 8, currentStock: 8 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Poster',
      category: 'Print',
      variants: [
        { id: uuidv4(), productId: '', name: 'Poster A1', attributes: { size: 'A1' }, price: 15, initialStock: 30, currentStock: 30 },
        { id: uuidv4(), productId: '', name: 'Poster A2', attributes: { size: 'A2' }, price: 10, initialStock: 25, currentStock: 25 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Vinyl Record',
      category: 'Music',
      variants: [
        { id: uuidv4(), productId: '', name: 'Vinyl LP Black', attributes: { format: 'LP', color: 'Black' }, price: 30, initialStock: 15, currentStock: 15 },
        { id: uuidv4(), productId: '', name: 'Vinyl LP Coloured', attributes: { format: 'LP', color: 'Coloured' }, price: 35, initialStock: 8, currentStock: 8 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Enamel Pin',
      category: 'Accessories',
      variants: [
        { id: uuidv4(), productId: '', name: 'Pin Logo', attributes: { design: 'Logo' }, price: 8, initialStock: 50, currentStock: 50 },
        { id: uuidv4(), productId: '', name: 'Pin Tour', attributes: { design: 'Tour' }, price: 8, initialStock: 40, currentStock: 40 },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Hoodie',
      category: 'Apparel',
      variants: [
        { id: uuidv4(), productId: '', name: 'Hoodie Black M', attributes: { color: 'Black', size: 'M' }, price: 55, initialStock: 6, currentStock: 6 },
        { id: uuidv4(), productId: '', name: 'Hoodie Black L', attributes: { color: 'Black', size: 'L' }, price: 55, initialStock: 4, currentStock: 4 },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Fix productId references
  for (const p of products) {
    for (const v of p.variants) {
      v.productId = p.id;
    }
    await db.put('products', p);
  }

  // Demo shows
  const shows: Show[] = [
    {
      id: uuidv4(),
      name: 'Summer Solstice Tour',
      venue: 'Altice Arena',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      city: 'Lisbon',
      status: 'upcoming',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'NOS Alive 2026',
      venue: 'Passeio Marítimo de Algés',
      date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
      city: 'Lisbon',
      status: 'completed',
      createdAt: now,
    },
  ];

  for (const s of shows) {
    await db.put('shows', s);
  }
}
