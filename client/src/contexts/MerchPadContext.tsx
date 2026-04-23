/**
 * MerchPad Global Context
 * Manages: active session, tally state, sync status, products, shows
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getDB, getDeviceId, getSetting, setSetting, enqueueSync, addAuditEntry, seedDemoData,
  Product, ProductVariant, Show, SaleSession, TallyBatch, StockAdjustment, AuditEntry,
  calcStockStatus, StockStatus,
} from '../lib/db';

// ── Tally State ────────────────────────────────────────────────────────────

export interface TallyItem {
  variantId: string;
  variantName: string;
  qty: number;
  unitPrice: number;
}

export interface TallyState {
  items: Record<string, TallyItem>; // variantId → TallyItem
  lastAction: { variantName: string; action: '+1' | '-1'; timestamp: string } | null;
}

// ── App State ──────────────────────────────────────────────────────────────

export type SyncStatus = 'online' | 'offline' | 'syncing';

export interface AppState {
  deviceId: string;
  repName: string;
  products: Product[];
  shows: Show[];
  activeSession: SaleSession | null;
  tally: TallyState;
  syncStatus: SyncStatus;
  isLoading: boolean;
  pendingSyncCount: number;
  settings: {
    undoEnabled: boolean;
    stockThresholdYellow: number; // 0.3
    stockThresholdRed: number;    // 0.1
  };
}

// ── Actions ────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_SHOWS'; payload: Show[] }
  | { type: 'SET_REP_NAME'; payload: string }
  | { type: 'SET_ACTIVE_SESSION'; payload: SaleSession | null }
  | { type: 'TALLY_INCREMENT'; payload: { variantId: string; variantName: string; unitPrice: number } }
  | { type: 'TALLY_DECREMENT'; payload: { variantId: string; variantName: string } }
  | { type: 'TALLY_UNDO_LAST' }
  | { type: 'TALLY_CLEAR' }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_PENDING_SYNC_COUNT'; payload: number }
  | { type: 'SET_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'ADD_SHOW'; payload: Show }
  | { type: 'UPDATE_SHOW'; payload: Show }
  | { type: 'UPDATE_VARIANT_STOCK'; payload: { variantId: string; productId: string; delta: number } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };

    case 'SET_SHOWS':
      return { ...state, shows: action.payload };

    case 'SET_REP_NAME':
      return { ...state, repName: action.payload };

    case 'SET_ACTIVE_SESSION':
      return { ...state, activeSession: action.payload, tally: { items: {}, lastAction: null } };

    case 'TALLY_INCREMENT': {
      const { variantId, variantName, unitPrice } = action.payload;
      const existing = state.tally.items[variantId];
      return {
        ...state,
        tally: {
          items: {
            ...state.tally.items,
            [variantId]: {
              variantId,
              variantName,
              qty: (existing?.qty ?? 0) + 1,
              unitPrice,
            },
          },
          lastAction: { variantName, action: '+1', timestamp: new Date().toISOString() },
        },
      };
    }

    case 'TALLY_DECREMENT': {
      const { variantId, variantName } = action.payload;
      const existing = state.tally.items[variantId];
      if (!existing || existing.qty <= 0) return state;
      const newQty = existing.qty - 1;
      const newItems = { ...state.tally.items };
      if (newQty <= 0) {
        delete newItems[variantId];
      } else {
        newItems[variantId] = { ...existing, qty: newQty };
      }
      return {
        ...state,
        tally: {
          items: newItems,
          lastAction: { variantName, action: '-1', timestamp: new Date().toISOString() },
        },
      };
    }

    case 'TALLY_UNDO_LAST': {
      if (!state.tally.lastAction) return state;
      const { variantName } = state.tally.lastAction;
      // Find the variantId by name
      const variantId = Object.keys(state.tally.items).find(
        id => state.tally.items[id].variantName === variantName
      );
      if (!variantId) return state;
      const existing = state.tally.items[variantId];
      if (!existing) return state;
      const newQty = existing.qty - 1;
      const newItems = { ...state.tally.items };
      if (newQty <= 0) {
        delete newItems[variantId];
      } else {
        newItems[variantId] = { ...existing, qty: newQty };
      }
      return {
        ...state,
        tally: { items: newItems, lastAction: null },
      };
    }

    case 'TALLY_CLEAR':
      return { ...state, tally: { items: {}, lastAction: null } };

    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };

    case 'SET_PENDING_SYNC_COUNT':
      return { ...state, pendingSyncCount: action.payload };

    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'ADD_PRODUCT':
      return { ...state, products: [...state.products, action.payload] };

    case 'UPDATE_PRODUCT':
      return {
        ...state,
        products: state.products.map(p => p.id === action.payload.id ? action.payload : p),
      };

    case 'DELETE_PRODUCT':
      return { ...state, products: state.products.filter(p => p.id !== action.payload) };

    case 'ADD_SHOW':
      return { ...state, shows: [...state.shows, action.payload] };

    case 'UPDATE_SHOW':
      return {
        ...state,
        shows: state.shows.map(s => s.id === action.payload.id ? action.payload : s),
      };

    case 'UPDATE_VARIANT_STOCK': {
      const { variantId, productId, delta } = action.payload;
      return {
        ...state,
        products: state.products.map(p => {
          if (p.id !== productId) return p;
          return {
            ...p,
            variants: p.variants.map(v => {
              if (v.id !== variantId) return v;
              return { ...v, currentStock: Math.max(0, v.currentStock + delta) };
            }),
          };
        }),
      };
    }

    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface MerchPadContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // High-level actions
  startSession: (showId: string, repName: string, standName?: string) => Promise<SaleSession>;
  endSession: () => Promise<void>;
  confirmSale: () => Promise<TallyBatch | null>;
  adjustStock: (variantId: string, productId: string, variantName: string, delta: number, reason: StockAdjustment['reason'], notes?: string) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveShow: (show: Show) => Promise<void>;
  getVariantStockStatus: (variant: ProductVariant) => StockStatus;
  getSessionSoldQty: (variantId: string) => number;
  getTallyTotal: () => { units: number; revenue: number };
  getAuditLog: (sessionId?: string) => Promise<AuditEntry[]>;
  transferStock: (variantId: string, productId: string, variantName: string, direction: 'to_road' | 'to_warehouse', qty: number) => Promise<void>;
  startOneOffSession: (repName: string) => Promise<SaleSession>;
}

const MerchPadContext = createContext<MerchPadContextValue | null>(null);

export function useMerchPad(): MerchPadContextValue {
  const ctx = useContext(MerchPadContext);
  if (!ctx) throw new Error('useMerchPad must be used within MerchPadProvider');
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

const initialState: AppState = {
  deviceId: getDeviceId(),
  repName: '',
  products: [],
  shows: [],
  activeSession: null,
  tally: { items: {}, lastAction: null },
  syncStatus: navigator.onLine ? 'online' : 'offline',
  isLoading: true,
  pendingSyncCount: 0,
  settings: {
    undoEnabled: true,
    stockThresholdYellow: 0.3,
    stockThresholdRed: 0.1,
  },
};

export function MerchPadProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Boot ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      await seedDemoData();
      const db = await getDB();

      const [products, shows, repName, undoEnabled] = await Promise.all([
        db.getAll('products'),
        db.getAll('shows'),
        getSetting<string>('repName', ''),
        getSetting<boolean>('undoEnabled', true),
      ]);

      dispatch({ type: 'SET_PRODUCTS', payload: products });
      dispatch({ type: 'SET_SHOWS', payload: shows });
      dispatch({ type: 'SET_REP_NAME', payload: repName });
      dispatch({ type: 'SET_SETTINGS', payload: { undoEnabled } });

      // Restore active session if any
      const activeSessions = await db.getAllFromIndex('sessions', 'by-status', 'active');
      if (activeSessions.length > 0) {
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: activeSessions[0] });
      }

      // Count pending sync items
      const pending = await db.getAllFromIndex('syncQueue', 'by-status', 'pending');
      dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: pending.length });

      dispatch({ type: 'SET_LOADING', payload: false });
    }
    boot();
  }, []);

  // ── Online/Offline detection ─────────────────────────────────────────────

  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_SYNC_STATUS', payload: 'online' });
    const handleOffline = () => dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────

  const startSession = useCallback(async (showId: string, repName: string, standName?: string): Promise<SaleSession> => {
    const db = await getDB();
    const deviceId = getDeviceId();

    // Build stock snapshot from current product state
    const products = await db.getAll('products');
    const stockSnapshot: Record<string, number> = {};
    for (const p of products) {
      for (const v of p.variants) {
        stockSnapshot[v.id] = v.currentStock;
      }
    }

    const session: SaleSession = {
      id: uuidv4(),
      showId,
      deviceId,
      repName,
      standName,
      startedAt: new Date().toISOString(),
      status: 'active',
      sessionType: 'show',
      stockSnapshot,
    };

    await db.put('sessions', session);
    await setSetting('repName', repName);
    await addAuditEntry({
      sessionId: session.id,
      showId,
      deviceId,
      action: 'session_started',
      entityType: 'session',
      entityId: session.id,
      description: `Sale session started by ${repName}${standName ? ` at ${standName}` : ''}`,
      actorName: repName,
      timestamp: session.startedAt,
    });
    await enqueueSync('session_start', session);

    dispatch({ type: 'SET_ACTIVE_SESSION', payload: session });
    dispatch({ type: 'SET_REP_NAME', payload: repName });

    return session;
  }, []);

  const endSession = useCallback(async () => {
    const session = stateRef.current.activeSession;
    if (!session) return;

    const db = await getDB();
    const updatedSession: SaleSession = { ...session, status: 'ended', endedAt: new Date().toISOString() };
    await db.put('sessions', updatedSession);
    await addAuditEntry({
      sessionId: session.id,
      showId: session.showId,
      deviceId: session.deviceId,
      action: 'session_ended',
      entityType: 'session',
      entityId: session.id,
      description: `Sale session ended by ${session.repName}`,
      actorName: session.repName,
      timestamp: updatedSession.endedAt!,
    });
    await enqueueSync('session_end', updatedSession);
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
  }, []);

  const confirmSale = useCallback(async (): Promise<TallyBatch | null> => {
    const { tally, activeSession, repName, products: stateProducts } = stateRef.current;
    const items = Object.values(tally.items).filter(i => i.qty > 0);
    if (items.length === 0 || !activeSession) return null;

    const db = await getDB();
    const now = new Date().toISOString();
    const totalItems = items.reduce((s, i) => s + i.qty, 0);
    const totalPrice = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

    const batch: TallyBatch = {
      id: uuidv4(),
      sessionId: activeSession.id,
      showId: activeSession.showId,
      deviceId: activeSession.deviceId,
      repName,
      items: items.map(i => ({ variantId: i.variantId, variantName: i.variantName, qty: i.qty, unitPrice: i.unitPrice })),
      totalItems,
      totalPrice,
      confirmedAt: now,
      status: 'pending',
    };

    await db.put('tallyBatches', batch);

    // Decrement stock using in-memory state (avoids DB read race) then persist to DB
    for (const item of items) {
      for (const p of stateProducts) {
        const v = p.variants.find(v => v.id === item.variantId);
        if (v) {
          // Compute new stock from current in-memory value
          const newStock = Math.max(0, v.currentStock - item.qty);
          // Build updated product with new stock and persist
          const updatedProduct = {
            ...p,
            variants: p.variants.map(pv =>
              pv.id === v.id ? { ...pv, currentStock: newStock } : pv
            ),
          };
          await db.put('products', updatedProduct);
          // Dispatch delta so reducer updates state.products in one step
          dispatch({ type: 'UPDATE_VARIANT_STOCK', payload: { variantId: v.id, productId: p.id, delta: -item.qty } });
        }
      }
    }

    await addAuditEntry({
      sessionId: activeSession.id,
      showId: activeSession.showId,
      deviceId: activeSession.deviceId,
      action: 'tally_confirmed',
      entityType: 'tally_batch',
      entityId: batch.id,
      description: `Sale confirmed: ${totalItems} items · €${totalPrice.toFixed(2)} by ${repName}`,
      actorName: repName,
      newValue: batch.items,
      timestamp: now,
    });

    await enqueueSync('tally_batch', batch);

    const pending = await db.getAllFromIndex('syncQueue', 'by-status', 'pending');
    dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: pending.length });
    dispatch({ type: 'TALLY_CLEAR' });

    return batch;
  }, []);

  const adjustStock = useCallback(async (
    variantId: string,
    productId: string,
    variantName: string,
    delta: number,
    reason: StockAdjustment['reason'],
    notes?: string
  ) => {
    const db = await getDB();
    const { activeSession, repName } = stateRef.current;
    const now = new Date().toISOString();

    const adjustment: StockAdjustment = {
      id: uuidv4(),
      variantId,
      variantName,
      sessionId: activeSession?.id ?? 'no-session',
      showId: activeSession?.showId ?? 'no-show',
      delta,
      reason,
      notes,
      adjustedBy: repName || 'Unknown',
      adjustedAt: now,
    };

    await db.put('stockAdjustments', adjustment);

    // Update product stock
    const products = await db.getAll('products');
    for (const p of products) {
      if (p.id !== productId) continue;
      const v = p.variants.find(v => v.id === variantId);
      if (v) {
        v.currentStock = Math.max(0, v.currentStock + delta);
        await db.put('products', p);
        dispatch({ type: 'UPDATE_VARIANT_STOCK', payload: { variantId, productId, delta } });
      }
    }

    await addAuditEntry({
      sessionId: activeSession?.id ?? 'no-session',
      showId: activeSession?.showId ?? 'no-show',
      deviceId: getDeviceId(),
      action: 'stock_adjusted',
      entityType: 'product_variant',
      entityId: variantId,
      description: `Stock adjusted: ${variantName} ${delta > 0 ? '+' : ''}${delta} (${reason})${notes ? ` — ${notes}` : ''}`,
      actorName: repName || 'Unknown',
      reason,
      timestamp: now,
    });
  }, []);

  const saveProduct = useCallback(async (product: Product) => {
    const db = await getDB();
    await db.put('products', product);
    const existing = stateRef.current.products.find(p => p.id === product.id);
    if (existing) {
      dispatch({ type: 'UPDATE_PRODUCT', payload: product });
    } else {
      dispatch({ type: 'ADD_PRODUCT', payload: product });
    }
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    const db = await getDB();
    await db.delete('products', productId);
    dispatch({ type: 'DELETE_PRODUCT', payload: productId });
  }, []);

  const saveShow = useCallback(async (show: Show) => {
    const db = await getDB();
    await db.put('shows', show);
    const existing = stateRef.current.shows.find(s => s.id === show.id);
    if (existing) {
      dispatch({ type: 'UPDATE_SHOW', payload: show });
    } else {
      dispatch({ type: 'ADD_SHOW', payload: show });
    }
  }, []);

  // NOTE: intentionally NOT wrapped in useCallback with empty deps — must close over
  // reactive `state` so Tally cards re-render with fresh stock after each confirmed sale.
  const getVariantStockStatus = (variant: ProductVariant): StockStatus => {
    const { activeSession, settings, products } = state;
    // Use the live currentStock from the products array (updated via UPDATE_VARIANT_STOCK dispatch)
    const liveVariant = products.flatMap(p => p.variants).find(v => v.id === variant.id) ?? variant;
    const initial = activeSession?.stockSnapshot[variant.id] ?? liveVariant.initialStock;
    if (liveVariant.currentStock <= 0) return 'empty';
    const pct = liveVariant.currentStock / (initial || 1);
    if (pct > settings.stockThresholdYellow) return 'high';
    if (pct > settings.stockThresholdRed) return 'medium';
    return 'low';
  };

  const getSessionSoldQty = useCallback((variantId: string): number => {
    return stateRef.current.tally.items[variantId]?.qty ?? 0;
  }, []);

  const getTallyTotal = useCallback(() => {
    const items = Object.values(stateRef.current.tally.items);
    return {
      units: items.reduce((s, i) => s + i.qty, 0),
      revenue: items.reduce((s, i) => s + i.qty * i.unitPrice, 0),
    };
  }, []);

  const getAuditLog = useCallback(async (sessionId?: string): Promise<AuditEntry[]> => {
    const db = await getDB();
    if (sessionId) {
      return db.getAllFromIndex('auditLog', 'by-session', sessionId);
    }
    const all = await db.getAll('auditLog');
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, []);

  const transferStock = useCallback(async (
    variantId: string,
    productId: string,
    variantName: string,
    direction: 'to_road' | 'to_warehouse',
    qty: number
  ) => {
    const db = await getDB();
    const { repName } = stateRef.current;
    const now = new Date().toISOString();

    // Find the product and variant in current state
    const products = stateRef.current.products;
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) return;

    const warehouseStock = variant.warehouseStock ?? 0;
    const roadStock = variant.roadStock ?? variant.currentStock;

    let newWarehouse = warehouseStock;
    let newRoad = roadStock;

    if (direction === 'to_road') {
      const transfer = Math.min(qty, warehouseStock);
      newWarehouse = warehouseStock - transfer;
      newRoad = roadStock + transfer;
    } else {
      const transfer = Math.min(qty, roadStock);
      newRoad = roadStock - transfer;
      newWarehouse = warehouseStock + transfer;
    }

    // Build updated product
    const updatedProduct: Product = {
      ...product,
      variants: product.variants.map(v =>
        v.id === variantId
          ? { ...v, warehouseStock: newWarehouse, roadStock: newRoad, currentStock: newRoad }
          : v
      ),
      updatedAt: now,
    };

    await db.put('products', updatedProduct);
    dispatch({ type: 'UPDATE_PRODUCT', payload: updatedProduct });

    await addAuditEntry({
      sessionId: stateRef.current.activeSession?.id ?? 'no-session',
      showId: stateRef.current.activeSession?.showId ?? 'no-show',
      deviceId: getDeviceId(),
      action: 'stock_transferred',
      entityType: 'product_variant',
      entityId: variantId,
      description: `Stock transfer: ${variantName} — ${direction === 'to_road' ? `WH→Road +${qty}` : `Road→WH +${qty}`}`,
      actorName: repName || 'Unknown',
      oldValue: { warehouseStock, roadStock },
      newValue: { warehouseStock: newWarehouse, roadStock: newRoad },
      timestamp: now,
    });
  }, []);

  const startOneOffSession = useCallback(async (repName: string): Promise<SaleSession> => {
    const db = await getDB();
    const deviceId = getDeviceId();
    const products = stateRef.current.products;
    const stockSnapshot: Record<string, number> = {};
    for (const p of products) {
      for (const v of p.variants) { stockSnapshot[v.id] = v.currentStock; }
    }
    const session: SaleSession = {
      id: uuidv4(),
      showId: 'oneoff',
      deviceId,
      repName,
      startedAt: new Date().toISOString(),
      status: 'active',
      sessionType: 'oneoff',
      stockSnapshot,
    };
    await db.put('sessions', session);
    await setSetting('repName', repName);
    await addAuditEntry({
      sessionId: session.id,
      showId: 'oneoff',
      deviceId,
      action: 'session_started',
      entityType: 'session',
      entityId: session.id,
      description: `OneOff Sale started by ${repName}`,
      actorName: repName,
      timestamp: session.startedAt,
    });
    await enqueueSync('session_start', session);
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: session });
    dispatch({ type: 'SET_REP_NAME', payload: repName });
    return session;
  }, []);

  return (
    <MerchPadContext.Provider value={{
      state,
      dispatch,
      startSession,
      endSession,
      confirmSale,
      adjustStock,
      saveProduct,
      deleteProduct,
      saveShow,
      getVariantStockStatus,
      getSessionSoldQty,
      getTallyTotal,
      getAuditLog,
      transferStock,
      startOneOffSession,
    }}>
      {children}
    </MerchPadContext.Provider>
  );
}
