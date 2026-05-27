/**
 * MerchPad Global Context
 * Manages: active session, tally state, sync status, products, shows
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  getDB, getDeviceId, getSetting, setSetting, enqueueSync, addAuditEntry,
  getPendingSyncItems, markSyncItemDone, migrateStockTiers,
  Product, ProductVariant, Show, SaleSession, TallyBatch, StockAdjustment, AuditEntry,
  calcStockStatus, StockStatus, TeamMember,
} from '../lib/db';
import { startSyncWorker, stopSyncWorker, onSyncComplete } from '../lib/syncWorker';
import { restoreProjectFromServer } from '../lib/restoreFromServer';
import { useProjects } from './ProjectContext';

// ── Tally State ────────────────────────────────────────────────────────────

export interface TallyItem {
  variantId: string;
  variantName: string;
  qty: number;
  unitPrice: number;
}

export interface TallyState {
  items: Record<string, TallyItem>; // variantId → TallyItem
  lastAction: { variantId: string; variantName: string; action: '+1' | '-1'; timestamp: string } | null;
}

// ── App State ──────────────────────────────────────────────────────────────

export type SyncStatus = 'online' | 'offline' | 'syncing';

export interface AppState {
  deviceId: string;
  repName: string;
  products: Product[];
  shows: Show[];
  teamMembers: TeamMember[];
  activeSession: SaleSession | null;
  tally: TallyState;
  syncStatus: SyncStatus;
  isLoading: boolean;
  pendingSyncCount: number;
  settings: {
    undoEnabled: boolean;
    stockThresholdYellow: number;
    stockThresholdRed: number;
    requireMoneyInput: boolean;
    allowMidSaleRestock: boolean;
    stickyBarTally: boolean;
    stickyBarRegister: boolean;
    requireDiscountReason: boolean;
    allowSellerDebt: boolean;
    requireDebtReason: boolean;
    currency: string;
    defaultStockLocation: 'road' | 'warehouse';
    requireTransferNote: boolean;
    registerResetBigNumbers: boolean;
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
  | { type: 'TALLY_REMOVE_VARIANT'; payload: { variantId: string } }
  | { type: 'TALLY_CLEAR' }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_PENDING_SYNC_COUNT'; payload: number }
  | { type: 'SET_SETTINGS'; payload: Partial<AppState['settings']> }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'DELETE_PRODUCT'; payload: string }
  | { type: 'ADD_SHOW'; payload: Show }
  | { type: 'UPDATE_SHOW'; payload: Show }
  | { type: 'UPDATE_VARIANT_STOCK'; payload: { variantId: string; productId: string; delta: number; stockLocation?: 'road' | 'warehouse' } }
  | { type: 'SET_TEAM_MEMBERS'; payload: TeamMember[] }
  | { type: 'UPSERT_TEAM_MEMBER'; payload: TeamMember }
  | { type: 'DELETE_TEAM_MEMBER'; payload: string }
  | { type: 'DELETE_SHOW'; payload: string };

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
          lastAction: { variantId, variantName, action: '+1', timestamp: new Date().toISOString() },
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
          lastAction: { variantId, variantName, action: '-1', timestamp: new Date().toISOString() },
        },
      };
    }

    case 'TALLY_UNDO_LAST': {
      if (!state.tally.lastAction) return state;
      const { variantId } = state.tally.lastAction;
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
    case 'TALLY_REMOVE_VARIANT': {
      const newItems = { ...state.tally.items };
      delete newItems[action.payload.variantId];
      return { ...state, tally: { ...state.tally, items: newItems } };
    }

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

    case 'DELETE_SHOW':
      return { ...state, shows: state.shows.filter(s => s.id !== action.payload) };

    case 'SET_TEAM_MEMBERS':
      return { ...state, teamMembers: action.payload };

    case 'UPSERT_TEAM_MEMBER': {
      const exists = state.teamMembers.some(m => m.id === action.payload.id);
      return {
        ...state,
        teamMembers: exists
          ? state.teamMembers.map(m => m.id === action.payload.id ? action.payload : m)
          : [...state.teamMembers, action.payload],
      };
    }

    case 'DELETE_TEAM_MEMBER':
      return { ...state, teamMembers: state.teamMembers.filter(m => m.id !== action.payload) };

    case 'UPDATE_VARIANT_STOCK': {
      const { variantId, productId, delta, stockLocation = 'road' } = action.payload;
      return {
        ...state,
        products: state.products.map(p => {
          if (p.id !== productId) return p;
          return {
            ...p,
            variants: p.variants.map(v => {
              if (v.id !== variantId) return v;
              if (stockLocation === 'warehouse') {
                const newWarehouseStock = Math.max(0, (v.warehouseStock ?? 0) + delta);
                return { ...v, warehouseStock: newWarehouseStock };
              }
              const newRoadStock = Math.max(0, (v.roadStock ?? v.currentStock) + delta);
              return { ...v, currentStock: newRoadStock, roadStock: newRoadStock };
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
  confirmSale: (opts?: {
    shortfallType?: 'discount' | 'seller_debt';
    shortfallAmount?: number;
    shortfallReason?: string;
    shortfallMemberId?: string;
    tallyOverride?: TallyState;
  }) => Promise<TallyBatch | null>;
  recordSellerDebt: (memberId: string, amount: number) => Promise<void>;
  adjustStock: (variantId: string, productId: string, variantName: string, delta: number, reason: StockAdjustment['reason'], notes?: string, adjusterName?: string, stockLocation?: 'road' | 'warehouse') => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  saveShow: (show: Show) => Promise<void>;
  deleteShow: (showId: string) => Promise<void>;
  getVariantStockStatus: (variant: ProductVariant) => StockStatus;
  getSessionSoldQty: (variantId: string) => number;
  getTallyTotal: () => { units: number; revenue: number };
  getAuditLog: (sessionId?: string) => Promise<AuditEntry[]>;
  transferStock: (variantId: string, productId: string, variantName: string, direction: 'to_road' | 'to_warehouse', qty: number, note?: string) => Promise<void>;
  startOneOffSession: (repName: string) => Promise<SaleSession>;
  saveTeamMember: (member: TeamMember) => Promise<void>;
  deleteTeamMember: (memberId: string) => Promise<void>;
  getTeamMemberStats: (memberId: string) => Promise<{ shifts: number; hoursWorked: number; totalItems: number; totalRevenue: number }>;
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
  teamMembers: [],
  activeSession: null,
  tally: { items: {}, lastAction: null },
  syncStatus: navigator.onLine ? 'online' : 'offline',
  isLoading: true,
  pendingSyncCount: 0,
  settings: {
    undoEnabled: true,
    stockThresholdYellow: 0.3,
    stockThresholdRed: 0.1,
    requireMoneyInput: false,
    allowMidSaleRestock: false,
    stickyBarTally: true,
    stickyBarRegister: true,
    requireDiscountReason: true,
    allowSellerDebt: true,
    requireDebtReason: true,
    currency: 'EUR',
    defaultStockLocation: 'road',
    requireTransferNote: false,
    registerResetBigNumbers: false,
  },
};

export function MerchPadProvider({ children }: { children: React.ReactNode }) {
  const { activeProject } = useProjects();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── One-time DB migration (runs once on mount, not per project) ─────────

  useEffect(() => {
    migrateStockTiers().catch(err =>
      console.error('[MerchPad] Stock tier migration failed:', err)
    );
  }, []);

  // ── Boot ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      if (!activeProject) return;
      try {
      const db = await getDB();
      const projectId = activeProject.id;

      // Restore from server only when this device has NO local data at all for this
      // project (new device / cleared storage). Checking both products AND shows
      // prevents a false-positive restore after the user intentionally deletes products
      // via DangerZone, which would overwrite local-only shows with stale server data.
      const existingProducts = await db.getAllFromIndex('products', 'by-project', projectId);
      const existingShows = await db.getAllFromIndex('shows', 'by-project', projectId);
      const isEmptyProject = existingProducts.length === 0 && existingShows.length === 0;
      if (isEmptyProject && navigator.onLine) {
        await restoreProjectFromServer(projectId);
      }

      const [products, shows, repName, undoEnabled, requireMoneyInput, allowMidSaleRestock, stockThresholdYellow, stockThresholdRed, stickyBarTally, stickyBarRegister, requireDiscountReason, allowSellerDebt, requireDebtReason, currency, defaultStockLocation, requireTransferNote, registerResetBigNumbers] = await Promise.all([
        db.getAllFromIndex('products', 'by-project', projectId),
        db.getAllFromIndex('shows', 'by-project', projectId),
        getSetting<string>(projectId, 'repName', ''),
        getSetting<boolean>(projectId, 'undoEnabled', true),
        getSetting<boolean>(projectId, 'requireMoneyInput', false),
        getSetting<boolean>(projectId, 'allowMidSaleRestock', false),
        getSetting<number>(projectId, 'stockThresholdYellow', 0.3),
        getSetting<number>(projectId, 'stockThresholdRed', 0.1),
        getSetting<boolean>(projectId, 'stickyBarTally', true),
        getSetting<boolean>(projectId, 'stickyBarRegister', true),
        getSetting<boolean>(projectId, 'requireDiscountReason', true),
        getSetting<boolean>(projectId, 'allowSellerDebt', true),
        getSetting<boolean>(projectId, 'requireDebtReason', true),
        getSetting<string>(projectId, 'currency', 'EUR'),
        getSetting<'road' | 'warehouse'>(projectId, 'defaultStockLocation', 'road'),
        getSetting<boolean>(projectId, 'requireTransferNote', false),
        getSetting<boolean>(projectId, 'registerResetBigNumbers', false),
      ]);

      const teamMembers = await db.getAllFromIndex('teamMembers', 'by-project', projectId);
      dispatch({ type: 'SET_PRODUCTS', payload: products });
      dispatch({ type: 'SET_SHOWS', payload: shows });
      dispatch({ type: 'SET_TEAM_MEMBERS', payload: teamMembers });
      dispatch({ type: 'SET_REP_NAME', payload: repName });
      dispatch({ type: 'SET_SETTINGS', payload: {
        undoEnabled, requireMoneyInput, allowMidSaleRestock, stockThresholdYellow, stockThresholdRed,
        stickyBarTally, stickyBarRegister, requireDiscountReason, allowSellerDebt, requireDebtReason,
        currency, defaultStockLocation, requireTransferNote, registerResetBigNumbers
      } });
      // Restore active session if anyy
      const activeSessions = await db.getAllFromIndex('sessions', 'by-status', 'active');
      const projectActiveSessions = activeSessions.filter(s => s.projectId === projectId);
      if (projectActiveSessions.length > 0) {
        dispatch({ type: 'SET_ACTIVE_SESSION', payload: projectActiveSessions[0] });
      }

      // Count pending sync items
      const pending = await getPendingSyncItems(projectId);
      dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: pending.length });

      dispatch({ type: 'SET_LOADING', payload: false });
      } catch (err) {
        console.error('[MerchPad] Boot error:', err);
        // Still clear loading so the UI renders instead of hanging forever
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    boot();
  }, [activeProject]);

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

  // ── Sync worker — starts/restarts when active project changes ────────────

  useEffect(() => {
    if (!activeProject) return;
    const projectId = activeProject.id;

    startSyncWorker(projectId);

    const unsubscribe = onSyncComplete((pendingCount) => {
      dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: pendingCount });
    });

    return () => {
      stopSyncWorker();
      unsubscribe();
    };
  }, [activeProject]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const startSession = useCallback(async (showId: string, repName: string, standName?: string): Promise<SaleSession> => {
    if (!activeProject) throw new Error('No active project');
    const db = await getDB();
    const deviceId = getDeviceId();
    const projectId = activeProject.id;

    // Build stock snapshot from current product state
    const products = await db.getAllFromIndex('products', 'by-project', projectId);
    const stockSnapshot: Record<string, number> = {};
    for (const p of products) {
      for (const v of p.variants) {
        stockSnapshot[v.id] = v.currentStock;
      }
    }

    const session: SaleSession = {
      id: uuidv4(),
      projectId,
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
    await setSetting(projectId, 'repName', repName);
    await addAuditEntry(projectId, {
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
    await enqueueSync(projectId, 'session_start', session);

    dispatch({ type: 'SET_ACTIVE_SESSION', payload: session });
    dispatch({ type: 'SET_REP_NAME', payload: repName });

    return session;
  }, []);

  const endSession = useCallback(async () => {
    const session = stateRef.current.activeSession;
    if (!session || !activeProject) return;

    const db = await getDB();
    const projectId = activeProject.id;
    const updatedSession: SaleSession = { ...session, status: 'ended', endedAt: new Date().toISOString() };
    await db.put('sessions', updatedSession);
    await addAuditEntry(projectId, {
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
    await enqueueSync(projectId, 'session_end', updatedSession);
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: null });
  }, [activeProject]);

  const confirmSale = useCallback(async (opts?: {
    shortfallType?: 'discount' | 'seller_debt';
    shortfallAmount?: number;
    shortfallReason?: string;
    shortfallMemberId?: string;
    tallyOverride?: TallyState;
  }): Promise<TallyBatch | null> => {
    const { tally: stateTally, activeSession, repName, products: stateProducts } = stateRef.current;
    const tally = opts?.tallyOverride || stateTally;
    const items = Object.values(tally.items).filter(i => i.qty > 0);
    if (items.length === 0 || !activeSession) return null;

    const db = await getDB();
    const projectId = activeSession.projectId;
    const now = new Date().toISOString();
    const totalItems = items.reduce((s, i) => s + i.qty, 0);
    const totalPrice = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

    const batch: TallyBatch = {
      id: uuidv4(),
      projectId: activeSession.projectId,
      sessionId: activeSession.id,
      showId: activeSession.showId,
      deviceId: activeSession.deviceId,
      repName,
      items: items.map(i => ({ variantId: i.variantId, variantName: i.variantName, qty: i.qty, unitPrice: i.unitPrice })),
      totalItems,
      totalPrice,
      confirmedAt: now,
      status: 'pending',
      ...(opts?.shortfallType && {
        shortfallType: opts.shortfallType,
        shortfallAmount: opts.shortfallAmount,
        shortfallReason: opts.shortfallReason,
        shortfallMemberId: opts.shortfallMemberId,
      }),
    };

    await db.put('tallyBatches', batch);

    // Decrement stock using in-memory state (avoids DB read race) then persist to DB
    const updatedProductsMap = new Map<string, Product>();

    for (const item of items) {
      for (const p of stateProducts) {
        const v = p.variants.find(v => v.id === item.variantId);
        if (v) {
          const currentProduct = updatedProductsMap.get(p.id) || p;
          const existingVariant = currentProduct.variants.find(vv => vv.id === v.id);
          const newRoadStock = Math.max(0, (existingVariant?.roadStock ?? existingVariant?.currentStock ?? v.currentStock) - item.qty);

          const updatedProduct = {
            ...currentProduct,
            variants: currentProduct.variants.map(pv =>
              pv.id === v.id ? { ...pv, currentStock: newRoadStock, roadStock: newRoadStock } : pv
            ),
          };
          updatedProductsMap.set(p.id, updatedProduct);
          dispatch({ type: 'UPDATE_VARIANT_STOCK', payload: { variantId: v.id, productId: p.id, delta: -item.qty } });
        }
      }
    }

    for (const p of Array.from(updatedProductsMap.values())) {
      await db.put('products', p);
    }

    await addAuditEntry(projectId, {
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

    // Write shortfall-specific audit entry
    if (opts?.shortfallType === 'discount') {
      await addAuditEntry(projectId, {
        sessionId: activeSession.id,
        showId: activeSession.showId,
        deviceId: activeSession.deviceId,
        action: 'sale_discounted',
        entityType: 'tally_batch',
        entityId: batch.id,
        description: `Discount applied: €${opts.shortfallAmount?.toFixed(2)} shortfall${opts.shortfallReason ? ` — ${opts.shortfallReason}` : ''}`,
        actorName: repName,
        reason: opts.shortfallReason,
        timestamp: now,
      });
    } else if (opts?.shortfallType === 'seller_debt' && opts.shortfallMemberId) {
      const member = stateRef.current.teamMembers.find(m => m.id === opts.shortfallMemberId);
      await addAuditEntry(projectId, {
        sessionId: activeSession.id,
        showId: activeSession.showId,
        deviceId: activeSession.deviceId,
        action: 'seller_debt_recorded',
        entityType: 'team_member',
        entityId: opts.shortfallMemberId,
        description: `Seller debt: €${opts.shortfallAmount?.toFixed(2)} owed by ${member?.name ?? 'Unknown'}${opts.shortfallReason ? ` — ${opts.shortfallReason}` : ''}`,
        actorName: repName,
        reason: opts.shortfallReason,
        timestamp: now,
      });
    }

    await enqueueSync(projectId, 'tally_batch', batch);
    const pending = await getPendingSyncItems(projectId);
    dispatch({ type: 'SET_PENDING_SYNC_COUNT', payload: pending.length });
    return batch;
  }, []);

  const adjustStock = useCallback(async (
    variantId: string,
    productId: string,
    variantName: string,
    delta: number,
    reason: StockAdjustment['reason'],
    notes?: string,
    adjusterName?: string,
    stockLocation: 'road' | 'warehouse' = 'road'
  ) => {
    if (!activeProject) return;
    const db = await getDB();
    const projectId = activeProject.id;
    const { activeSession, repName } = stateRef.current;
    const now = new Date().toISOString();
    const resolvedAdjusterName = adjusterName?.trim() || repName || 'Unknown';

    const adjustment: StockAdjustment = {
      id: uuidv4(),
      projectId,
      variantId,
      variantName,
      sessionId: activeSession?.id ?? 'no-session',
      showId: activeSession?.showId ?? 'no-show',
      delta,
      reason,
      notes,
      adjustedBy: resolvedAdjusterName,
      adjustedAt: now,
    };

    await db.put('stockAdjustments', adjustment);
    await enqueueSync(projectId, 'stock_adjustment', adjustment);

    // Update product stock in IDB and optimistically in state
    const allProducts = await db.getAllFromIndex('products', 'by-project', projectId);
    for (const p of allProducts) {
      if (p.id !== productId) continue;
      const v = p.variants.find(pv => pv.id === variantId);
      if (v) {
        if (stockLocation === 'warehouse') {
          v.warehouseStock = Math.max(0, (v.warehouseStock ?? 0) + delta);
        } else {
          const newRoadStock = Math.max(0, (v.roadStock ?? v.currentStock) + delta);
          v.currentStock = newRoadStock;
          v.roadStock = newRoadStock;
        }
        await db.put('products', p);
        dispatch({ type: 'UPDATE_VARIANT_STOCK', payload: { variantId, productId, delta, stockLocation } });
      }
    }

    await addAuditEntry(projectId, {
      sessionId: activeSession?.id ?? 'no-session',
      showId: activeSession?.showId ?? 'no-show',
      deviceId: getDeviceId(),
      action: 'stock_adjusted',
      entityType: 'product_variant',
      entityId: variantId,
      description: `Stock adjusted (${stockLocation}): ${variantName} ${delta > 0 ? '+' : ''}${delta} (${reason})${notes ? ` — ${notes}` : ''}`,
      actorName: resolvedAdjusterName,
      reason,
      timestamp: now,
    });
  }, [activeProject]);

  const saveProduct = useCallback(async (product: Product) => {
    if (!activeProject) return;
    const db = await getDB();
    const taggedProduct = { ...product, projectId: activeProject.id };
    await db.put('products', taggedProduct);
    await enqueueSync(activeProject.id, 'product_upsert', taggedProduct);
    const existing = stateRef.current.products.find(p => p.id === taggedProduct.id);
    if (existing) {
      dispatch({ type: 'UPDATE_PRODUCT', payload: taggedProduct });
    } else {
      dispatch({ type: 'ADD_PRODUCT', payload: taggedProduct });
    }
  }, [activeProject]);

  const deleteProduct = useCallback(async (productId: string) => {
    if (!activeProject) return;
    const db = await getDB();
    await db.delete('products', productId);
    await enqueueSync(activeProject.id, 'product_delete', { id: productId });
    dispatch({ type: 'DELETE_PRODUCT', payload: productId });
  }, [activeProject]);

  const deleteShow = useCallback(async (showId: string) => {
    if (!activeProject) return;
    const db = await getDB();
    await db.delete('shows', showId);
    await enqueueSync(activeProject.id, 'show_delete', { id: showId });
    dispatch({ type: 'DELETE_SHOW', payload: showId });
  }, [activeProject]);

  const saveTeamMember = useCallback(async (member: TeamMember) => {
    if (!activeProject) return;
    const db = await getDB();
    const taggedMember = { ...member, projectId: activeProject.id };
    await db.put('teamMembers', taggedMember);
    await enqueueSync(activeProject.id, 'team_member_upsert', taggedMember);
    dispatch({ type: 'UPSERT_TEAM_MEMBER', payload: taggedMember });
  }, [activeProject]);

  const deleteTeamMember = useCallback(async (memberId: string) => {
    if (!activeProject) return;
    const db = await getDB();
    await db.delete('teamMembers', memberId);
    await enqueueSync(activeProject.id, 'team_member_delete', { id: memberId });
    dispatch({ type: 'DELETE_TEAM_MEMBER', payload: memberId });
  }, [activeProject]);

  const getTeamMemberStats = useCallback(async (memberId: string) => {
    if (!activeProject) return { shifts: 0, hoursWorked: 0, totalItems: 0, totalRevenue: 0 };
    const db = await getDB();
    const projectId = activeProject.id;
    const member = stateRef.current.teamMembers.find(m => m.id === memberId);
    if (!member) return { shifts: 0, hoursWorked: 0, totalItems: 0, totalRevenue: 0 };
    // Sessions where repName matches member name
    const allSessions = await db.getAllFromIndex('sessions', 'by-project', projectId);
    const memberSessions = allSessions.filter(s => s.repName === member.name);
    const shifts = memberSessions.length;
    const hoursWorked = memberSessions.reduce((sum, s) => {
      if (!s.endedAt) return sum;
      const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
      return sum + ms / 3_600_000;
    }, 0);
    // Tally batches for those sessions
    let totalItems = 0;
    let totalRevenue = 0;
    for (const s of memberSessions) {
      const batches = await db.getAllFromIndex('tallyBatches', 'by-session', s.id);
      for (const b of batches) {
        if (b.status !== 'voided') {
          totalItems += b.totalItems;
          totalRevenue += b.totalPrice;
        }
      }
    }
    return { shifts, hoursWorked, totalItems, totalRevenue };
  }, [activeProject]);

  const recordSellerDebt = useCallback(async (memberId: string, amount: number) => {
    if (!activeProject) return;
    const db = await getDB();
    const member = await db.get('teamMembers', memberId);
    if (!member) return;
    const updated: TeamMember = { ...member, totalDebt: (member.totalDebt ?? 0) + amount, updatedAt: new Date().toISOString() };
    await db.put('teamMembers', updated);
    dispatch({ type: 'UPSERT_TEAM_MEMBER', payload: updated });
  }, [activeProject]);

  const saveShow = useCallback(async (show: Show) => {
    if (!activeProject) return;
    const db = await getDB();
    const taggedShow = { ...show, projectId: activeProject.id };
    await db.put('shows', taggedShow);
    await enqueueSync(activeProject.id, 'show_upsert', taggedShow);
    const existing = stateRef.current.shows.find(s => s.id === taggedShow.id);
    if (existing) {
      dispatch({ type: 'UPDATE_SHOW', payload: taggedShow });
    } else {
      dispatch({ type: 'ADD_SHOW', payload: taggedShow });
    }
  }, [activeProject]);

  // NOTE: intentionally NOT wrapped in useCallback with empty deps — must close over
  // reactive `state` so Tally cards re-render with fresh stock after each confirmed sale.
  const getVariantStockStatus = (variant: ProductVariant): StockStatus => {
    const { activeSession, settings, products } = state;
    // Use the live currentStock from the products array (updated via UPDATE_VARIANT_STOCK dispatch)
    const liveVariant = products.flatMap(p => p.variants).find(v => v.id === variant.id) ?? variant;
    const initial = activeSession?.stockSnapshot[variant.id] ?? liveVariant.initialStock;
    const current = liveVariant.roadStock ?? liveVariant.currentStock;
    if (current <= 0) return 'empty';
    const pct = current / (initial || 1);
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
    if (!activeProject) return [];
    const db = await getDB();
    const projectId = activeProject.id;
    if (sessionId) {
      return db.getAllFromIndex('auditLog', 'by-session', sessionId);
    }
    const all = await db.getAllFromIndex('auditLog', 'by-project', projectId);
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [activeProject]);

  const transferStock = useCallback(async (
    variantId: string,
    productId: string,
    variantName: string,
    direction: 'to_road' | 'to_warehouse',
    qty: number,
    note?: string
  ) => {
    if (!activeProject) return;
    const db = await getDB();
    const projectId = activeProject.id;
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

    await addAuditEntry(projectId, {
      sessionId: stateRef.current.activeSession?.id ?? 'no-session',
      showId: stateRef.current.activeSession?.showId ?? 'no-show',
      deviceId: getDeviceId(),
      action: 'stock_transferred',
      entityType: 'product_variant',
      entityId: variantId,
      description: `Stock transfer: ${variantName} — ${direction === 'to_road' ? `WH→Road +${qty}` : `Road→WH +${qty}`}${note ? ` | Note: ${note}` : ''}`,
      actorName: repName || 'Unknown',
      oldValue: { warehouseStock, roadStock },
      newValue: { warehouseStock: newWarehouse, roadStock: newRoad },
      reason: note,
      timestamp: now,
    });
  }, [activeProject]);

  const startOneOffSession = useCallback(async (repName: string): Promise<SaleSession> => {
    if (!activeProject) throw new Error('No active project');
    const db = await getDB();
    const deviceId = getDeviceId();
    const projectId = activeProject.id;
    const products = stateRef.current.products;
    const stockSnapshot: Record<string, number> = {};
    for (const p of products) {
      for (const v of p.variants) { stockSnapshot[v.id] = v.currentStock; }
    }
    const session: SaleSession = {
      id: uuidv4(),
      projectId,
      showId: 'oneoff',
      deviceId,
      repName,
      startedAt: new Date().toISOString(),
      status: 'active',
      sessionType: 'oneoff',
      stockSnapshot,
    };
    await db.put('sessions', session);
    await setSetting(projectId, 'repName', repName);
    await addAuditEntry(projectId, {
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
    await enqueueSync(projectId, 'session_start', session);
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: session });
    dispatch({ type: 'SET_REP_NAME', payload: repName });
    return session;
  }, [activeProject]);

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
      deleteShow,
      getVariantStockStatus,
      getSessionSoldQty,
      getTallyTotal,
      getAuditLog,
      transferStock,
      startOneOffSession,
      saveTeamMember,
      deleteTeamMember,
      getTeamMemberStats,
      recordSellerDebt,
    }}>
      {children}
    </MerchPadContext.Provider>
  );
}
