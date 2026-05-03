/**
 * Detail Info — analytics dashboard
 * Design: "Neon Ledger" — KPI cards, Recharts charts, filters, audit trail
 * Tabs: Analytics | Stock | Audit Trail
 * Filters: time range (today / session / all), category, product
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle, TrendingDown, TrendingUp, ChevronDown, ChevronUp,
  Sliders, Clock, Package, BarChart2, X,
} from 'lucide-react';
import { RightDrawer } from '../components/RightDrawer';
import { ExportButton } from '../components/ExportSheet';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { AuditEntry, getDB } from '../lib/db';
import { cn } from '../lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number, currency = 'EUR') {
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  return `${symbol}${n.toFixed(2)}`;
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  tally_confirmed: { label: 'Sale', color: '#4ADE80' },
  tally_voided: { label: 'Voided', color: '#F87171' },
  stock_adjusted: { label: 'Adjustment', color: '#FBBF24' },
  stock_transferred: { label: 'Transfer', color: '#00E5FF' },
  session_started: { label: 'Session Start', color: '#6B5CFF' },
  session_ended: { label: 'Session End', color: '#7B7F93' },
  tally_undo: { label: 'Undo', color: '#F87171' },
};

const CHART_COLORS = ['#6B5CFF', '#C026D3', '#00E5FF', '#4ADE80', '#FBBF24', '#F87171'];

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs"
      style={{ background: '#1B1E2E', border: '1px solid #2D3048', color: '#E6E7EB' }}>
      {label && <p className="text-[#7B7F93] mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? '#E6E7EB' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.name?.toLowerCase().includes('rev')
            ? formatCurrency(p.value, currency) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Stock Adjustment Modal ─────────────────────────────────────────────────

interface AdjustmentModalProps {
  variantId: string; productId: string; variantName: string; currentStock: number;
  onSave: (delta: number, reason: 'damaged' | 'theft' | 'counting_error' | 'restock' | 'other', notes: string) => void;
  onClose: () => void;
}

export function AdjustmentModal({ variantName, currentStock, onSave, onClose }: AdjustmentModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('remove');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<'damaged' | 'theft' | 'counting_error' | 'restock' | 'other'>('counting_error');
  const [notes, setNotes] = useState('');
  const delta = mode === 'add' ? parseInt(qty) || 0 : -(parseInt(qty) || 0);
  const newStock = Math.max(0, currentStock + delta);

  return (
    <RightDrawer open={true} onClose={onClose} title="Stock Adjustment" subtitle={variantName}>
      <div className="overflow-y-auto p-3 space-y-3">
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {(['remove', 'add'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={cn('flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5',
                mode === m ? 'text-foreground' : 'text-muted-foreground')}
              style={mode === m ? { background: m === 'remove' ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)' } : { background: 'var(--muted)' }}>
              {m === 'remove' ? <><TrendingDown size={14} /> Remove</> : <><TrendingUp size={14} /> Add</>}
            </button>
          ))}
        </div>
        <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-lg font-bold text-center text-foreground border focus:outline-none"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }} />
        <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--muted)' }}>
          <span className="text-xs text-muted-foreground">Current → New</span>
          <span className="text-sm font-bold">
            <span className="text-foreground">{currentStock}</span>
            <span className="text-muted-foreground mx-1">→</span>
            <span className={newStock < currentStock ? 'text-[#F87171]' : 'text-[#4ADE80]'}>{newStock}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['damaged', 'theft', 'counting_error', 'restock', 'other'] as const).map(r => (
            <button key={r} onClick={() => setReason(r)}
              className={cn('py-2 rounded-lg text-xs font-semibold capitalize',
                reason === r ? 'text-primary' : 'text-muted-foreground')}
              style={reason === r
                ? { background: 'rgba(107,92,255,0.15)', border: '1px solid var(--primary)', color: 'var(--primary)' }
                : { background: 'var(--muted)', border: '1px solid var(--border)' }}>
              {r.replace('_', ' ')}
            </button>
          ))}
        </div>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…"
          className="w-full px-3 py-2 rounded-lg text-sm text-foreground border focus:outline-none placeholder:text-muted-foreground"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }} />
      </div>
      <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground"
          style={{ border: '1px solid var(--border)' }}>Cancel</button>
        <button onClick={() => { if (!qty || parseInt(qty) <= 0) { toast.error('Enter a valid quantity'); return; } onSave(delta, reason, notes); }}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">Apply</button>
      </div>
    </RightDrawer>
  );
}

// ── Audit Timeline ─────────────────────────────────────────────────────────

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return (
    <div className="text-center py-8">
      <Clock size={24} className="text-[#7B7F93] mx-auto mb-2" />
      <p className="text-sm text-[#7B7F93]">No activity yet</p>
    </div>
  );
  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: '#7B7F93' };
        return (
          <div key={entry.id} className="flex gap-3 pb-4 relative">
            {i < entries.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[#24273A]" />}
            <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
              style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                  <p className="text-sm text-[#A4A7B5] leading-snug mt-0.5">{entry.description}</p>
                  {entry.reason && <span className="text-xs text-[#7B7F93] capitalize">Reason: {entry.reason.replace('_', ' ')}</span>}
                </div>
                <span className="text-xs text-[#7B7F93] flex-shrink-0">{formatTime(entry.timestamp)}</span>
              </div>
              <p className="text-xs text-[#7B7F93] mt-0.5">by {entry.actorName}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

type TimeRange = 'today' | 'session' | 'all';
type Tab = 'analytics' | 'stock' | 'audit';

export default function DetailInfo() {
  const { state, adjustStock, getVariantStockStatus } = useMerchPad();
  const { products, activeSession, settings } = state;
  const currency = settings.currency ?? 'EUR';

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [adjustingVariant, setAdjustingVariant] = useState<{
    variantId: string; productId: string; variantName: string; currentStock: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('analytics');

  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const activeProducts = useMemo(() => products.filter(p => p.status !== 'suspended'), [products]);

  const categories = useMemo(() => {
    const cats = new Set(activeProducts.map(p => p.category).filter(Boolean));
    return Array.from(cats) as string[];
  }, [activeProducts]);

  useEffect(() => {
    async function load() {
      const db = await getDB();
      const all = await db.getAll('auditLog');
      setAuditEntries(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    }
    load();
  }, [activeSession, products]);

  // variant → product lookup for filters
  const variantProductMap = useMemo(() => {
    const map = new Map<string, { productId: string; category?: string }>();
    for (const p of activeProducts) {
      for (const v of p.variants) {
        map.set(v.id, { productId: p.id, category: p.category });
      }
    }
    return map;
  }, [activeProducts]);

  // ── Filtered sale entries ──────────────────────────────────────────────

  const filteredSaleEntries = useMemo(() => {
    let entries = auditEntries.filter(e => e.action === 'tally_confirmed');

    // Time filter
    if (timeRange === 'today') {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      entries = entries.filter(e => new Date(e.timestamp) >= todayStart);
    } else if (timeRange === 'session' && activeSession) {
      entries = entries.filter(e => new Date(e.timestamp) >= new Date(activeSession.startedAt));
    }

    // Product filter
    if (filterProduct !== 'all') {
      entries = entries.filter(e => {
        const items = e.newValue as Array<{ variantId: string }> | undefined;
        return items?.some(i => variantProductMap.get(i.variantId)?.productId === filterProduct);
      });
    }

    // Category filter
    if (filterCategory !== 'all') {
      entries = entries.filter(e => {
        const items = e.newValue as Array<{ variantId: string }> | undefined;
        return items?.some(i => variantProductMap.get(i.variantId)?.category === filterCategory);
      });
    }

    return entries;
  }, [auditEntries, timeRange, activeSession, filterProduct, filterCategory, variantProductMap]);

  // ── KPI metrics ────────────────────────────────────────────────────────

  const { totalRevenue, totalUnitsSold, totalBatches, avgBatchValue } = useMemo(() => {
    let rev = 0, units = 0, batches = filteredSaleEntries.length;
    for (const e of filteredSaleEntries) {
      const items = e.newValue as Array<{ qty: number; unitPrice: number }> | undefined;
      if (!items) continue;
      for (const i of items) { rev += i.qty * i.unitPrice; units += i.qty; }
    }
    return { totalRevenue: rev, totalUnitsSold: units, totalBatches: batches, avgBatchValue: batches > 0 ? rev / batches : 0 };
  }, [filteredSaleEntries]);

  // ── Sales over time (15-min buckets) ──────────────────────────────────

  const salesOverTime = useMemo(() => {
    if (filteredSaleEntries.length === 0) return [];
    const buckets: Record<string, { time: string; revenue: number; units: number }> = {};
    for (const e of filteredSaleEntries) {
      const d = new Date(e.timestamp);
      d.setMinutes(Math.floor(d.getMinutes() / 15) * 15, 0, 0);
      const key = d.toISOString();
      const label = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      if (!buckets[key]) buckets[key] = { time: label, revenue: 0, units: 0 };
      const items = e.newValue as Array<{ qty: number; unitPrice: number }> | undefined;
      if (items) for (const i of items) { buckets[key].revenue += i.qty * i.unitPrice; buckets[key].units += i.qty; }
    }
    return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time));
  }, [filteredSaleEntries]);

  // ── Revenue by product ─────────────────────────────────────────────────

  const revenueByProduct = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; units: number }> = {};
    for (const e of filteredSaleEntries) {
      const items = e.newValue as Array<{ qty: number; unitPrice: number; variantName?: string; productName?: string }> | undefined;
      if (!items) continue;
      for (const i of items) {
        const name = i.productName ?? i.variantName ?? 'Unknown';
        if (!map[name]) map[name] = { name, revenue: 0, units: 0 };
        map[name].revenue += i.qty * i.unitPrice;
        map[name].units += i.qty;
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filteredSaleEntries]);

  // ── Stock health ────────────────────────────────────────────────────────

  const stockHealth = useMemo(() => {
    let high = 0, medium = 0, low = 0, empty = 0;
    for (const p of activeProducts) {
      for (const v of p.variants) {
        const s = getVariantStockStatus(v);
        if (s === 'high') high++;
        else if (s === 'medium') medium++;
        else if (s === 'low') low++;
        else empty++;
      }
    }
    return [
      { name: 'High', value: high, color: '#4ADE80' },
      { name: 'Medium', value: medium, color: '#FBBF24' },
      { name: 'Low', value: low, color: '#F87171' },
      { name: 'Empty', value: empty, color: '#7B7F93' },
    ].filter(d => d.value > 0);
  }, [activeProducts, getVariantStockStatus]);

  const lowStockVariants = useMemo(() => activeProducts.flatMap(p =>
    p.variants.filter(v => { const s = getVariantStockStatus(v); return s === 'low' || s === 'empty'; })
      .map(v => ({ variant: v, productName: p.name, productId: p.id }))
  ), [activeProducts, getVariantStockStatus]);

  const handleAdjust = useCallback(async (
    delta: number, reason: 'damaged' | 'theft' | 'counting_error' | 'restock' | 'other', notes: string
  ) => {
    if (!adjustingVariant) return;
    await adjustStock(adjustingVariant.variantId, adjustingVariant.productId, adjustingVariant.variantName, delta, reason, notes);
    setAdjustingVariant(null);
    toast.success('Stock adjusted');
    const db = await getDB();
    const all = await db.getAll('auditLog');
    setAuditEntries(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  }, [adjustingVariant, adjustStock]);

  function exportCSV() {
    const rows = [
      ['Timestamp', 'Action', 'Description', 'Actor', 'Reason'],
      ...auditEntries.map(e => [e.timestamp, e.action, e.description, e.actorName, e.reason ?? '']),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `merchpad-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }

  const activeFiltersCount = (timeRange !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0) + (filterProduct !== 'all' ? 1 : 0);

  const pillStyle = (active: boolean) => {
    if (active) return { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' };
    return { background: 'var(--pill-bg)', border: '1px solid var(--pill-border)' };
  };

  return (
    <div className="min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-widest mb-1">Detail Info</p>
          <h1 className="text-2xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Analytics
          </h1>
        </div>
        <div className="mt-1">
          <ExportButton auditEntries={auditEntries} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {/* Time range pills */}
          {(['today', 'session', 'all'] as TimeRange[]).map(t => (
            <button key={t} onClick={() => setTimeRange(t)}
              className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize',
                timeRange === t ? 'text-white' : 'text-[var(--pill-text)] hover:text-[#A4A7B5]')}
              style={pillStyle(timeRange === t)}>
              {t === 'session' ? 'This Session' : t === 'today' ? 'Today' : 'All Time'}
            </button>
          ))}

          <div className="w-px h-4 bg-[#2D3048] flex-shrink-0" />

          {/* Category filter */}
          {categories.length > 0 && (
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--pill-text)] bg-[var(--pill-bg)] border border-[var(--pill-border)] focus:outline-none appearance-none cursor-pointer">
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Product filter */}
          <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--pill-text)] bg-[var(--pill-bg)] border border-[var(--pill-border)] focus:outline-none appearance-none cursor-pointer">
            <option value="all">All Products</option>
            {activeProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {activeFiltersCount > 0 && (
            <button onClick={() => { setTimeRange('all'); setFilterCategory('all'); setFilterProduct('all'); }}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#F87171]"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <X size={10} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Revenue', value: formatCurrency(totalRevenue), sub: `${totalUnitsSold} units`, color: '#4ADE80', trend: null },
          { label: 'Avg Batch', value: formatCurrency(avgBatchValue), sub: `${totalBatches} batches`, color: '#7C6DFF', trend: null },
          { label: 'Units Sold', value: totalUnitsSold.toString(), sub: 'items sold', color: '#00E5FF', trend: null },
          { label: 'Stock Alerts', value: lowStockVariants.length.toString(), sub: 'variants low/empty', color: lowStockVariants.length > 0 ? '#F87171' : '#4ADE80', trend: null },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="mp-card p-3.5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-4 translate-x-4"
              style={{ background: color }} />
            <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1">{label}</p>
            <p className="text-2xl font-black leading-none mb-1" style={{ color, fontVariantNumeric: 'tabular-nums' }}>{value}</p>
            <p className="text-xs text-[#7B7F93]">{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--pill-border)', background: 'var(--pill-bg)' }}>
          {([
            { id: 'analytics', label: 'Charts', icon: BarChart2 },
            { id: 'stock', label: 'Stock', icon: Package },
            { id: 'audit', label: 'Audit', icon: Clock },
          ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('flex-1 py-2.5 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
                activeTab === id ? 'text-white' : 'text-[var(--pill-text)]')}
              style={pillStyle(activeTab === id)}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6">

        {/* ── Analytics Tab ─────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">

            {/* Sales over time */}
            <div className="mp-card p-4">
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-3">Revenue Over Time</p>
              {salesOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={salesOverTime} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6B5CFF" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6B5CFF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fill: '#7B7F93', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7B7F93', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6B5CFF" strokeWidth={2}
                      fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: '#6B5CFF' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="text-sm text-[#7B7F93]">No sales data for this period</p>
                </div>
              )}
            </div>

            {/* Units sold over time */}
            {salesOverTime.length > 0 && (
              <div className="mp-card p-4">
                <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-3">Units Sold Over Time</p>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={salesOverTime} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="time" tick={{ fill: '#7B7F93', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#7B7F93', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                    <Bar dataKey="units" name="Units" radius={[4, 4, 0, 0]}>
                      {salesOverTime.map((_, i) => (
                        <Cell key={i} fill={`rgba(192,38,211,${0.5 + (i / salesOverTime.length) * 0.5})`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Revenue by product */}
            {revenueByProduct.length > 0 && (
              <div className="mp-card p-4">
                <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-3">Revenue by Product</p>
                <ResponsiveContainer width="100%" height={Math.max(120, revenueByProduct.length * 36)}>
                  <BarChart data={revenueByProduct} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                    <XAxis type="number" tick={{ fill: '#7B7F93', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => formatCurrency(v, currency)} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#A4A7B5', fontSize: 11 }} axisLine={false}
                      tickLine={false} width={80} />
                    <Tooltip content={<ChartTooltip currency={currency} />} />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                      {revenueByProduct.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Stock health donut */}
            {stockHealth.length > 0 && (
              <div className="mp-card p-4">
                <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-3">Stock Health</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={stockHealth} dataKey="value" cx="50%" cy="50%" innerRadius={32} outerRadius={52}
                        paddingAngle={3} strokeWidth={0}>
                        {stockHealth.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip currency={currency} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {stockHealth.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                          <span className="text-xs text-[#A4A7B5]">{d.name}</span>
                        </div>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Top items table */}
            {revenueByProduct.length > 0 && (
              <div className="mp-card mp-top-items overflow-hidden">
                <div className="px-3 py-2.5 border-b border-[#24273A] flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Top Items</p>
                  <p className="text-xs text-[#7B7F93]">Revenue · Units</p>
                </div>
                {revenueByProduct.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3 px-3 py-2.5 border-b border-[#1B1E2E] last:border-0">
                    <span className="text-xs font-bold text-[#7B7F93] w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#E6E7EB] truncate">{item.name}</p>
                      {/* Mini bar */}
                      <div className="mt-1 h-1 rounded-full bg-[#24273A] overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(item.revenue / revenueByProduct[0].revenue) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#E6E7EB]">{formatCurrency(item.revenue, currency)}</p>
                      <p className="text-xs text-[#7B7F93]">×{item.units}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredSaleEntries.length === 0 && (
              <div className="text-center py-12">
                <BarChart2 size={32} className="text-[#7B7F93] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#A4A7B5]">No sales data</p>
                <p className="text-xs text-[#7B7F93] mt-1">Start a sale session to see analytics here</p>
              </div>
            )}
          </div>
        )}

        {/* ── Stock Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'stock' && (
          <div className="space-y-3">
            {lowStockVariants.length > 0 && (
              <div className="rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(248,113,113,0.2)]">
                  <AlertTriangle size={14} className="text-[#F87171]" />
                  <span className="text-xs font-bold text-[#F87171] uppercase tracking-wider">
                    {lowStockVariants.length} Low / Empty
                  </span>
                </div>
                {lowStockVariants.map(({ variant, productName, productId }) => {
                  const status = getVariantStockStatus(variant);
                  return (
                    <div key={variant.id} className="flex items-center justify-between px-3 py-2.5 border-b border-[rgba(248,113,113,0.1)] last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-[#E6E7EB]">{variant.name}</p>
                        <p className="text-xs text-[#7B7F93]">{productName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-bold', status === 'empty' ? 'text-[#F87171]' : 'text-[#FBBF24]')}>
                          {variant.currentStock}
                        </span>
                        <button onClick={() => setAdjustingVariant({ variantId: variant.id, productId, variantName: variant.name, currentStock: variant.currentStock })}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-[#7C6DFF]"
                          style={{ background: 'rgba(107,92,255,0.1)', border: '1px solid rgba(107,92,255,0.2)' }}>
                          Adjust
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeProducts.map(product => (
              <div key={product.id} className="mp-card overflow-hidden">
                <button onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  className="w-full flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Package size={15} className="text-[#7C6DFF]" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#E6E7EB]">{product.name}</p>
                      <p className="text-xs text-[#7B7F93]">{product.variants.length} variants</p>
                    </div>
                  </div>
                  {expandedProduct === product.id ? <ChevronUp size={14} className="text-[#7B7F93]" /> : <ChevronDown size={14} className="text-[#7B7F93]" />}
                </button>
                {expandedProduct === product.id && (
                  <div className="border-t border-[#24273A] divide-y divide-[#1B1E2E]">
                    {product.variants.map(v => {
                      const status = getVariantStockStatus(v);
                      const stockColor = status === 'high' ? '#4ADE80' : status === 'medium' ? '#FBBF24' : '#F87171';
                      const pct = v.initialStock > 0 ? (v.currentStock / v.initialStock) * 100 : 0;
                      return (
                        <div key={v.id} className="px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div>
                              <p className="text-sm text-[#E6E7EB]">{v.name}</p>
                              <p className="text-xs text-[#7B7F93]">{formatCurrency(v.price, currency)}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-bold" style={{ color: stockColor }}>{v.currentStock}</p>
                                <p className="text-xs text-[#7B7F93]">of {v.initialStock}</p>
                              </div>
                              <button onClick={() => setAdjustingVariant({ variantId: v.id, productId: product.id, variantName: v.name, currentStock: v.currentStock })}
                                className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB]"
                                style={{ border: '1px solid #2D3048' }}>
                                <Sliders size={13} />
                              </button>
                            </div>
                          </div>
                          {/* Stock bar */}
                          <div className="h-1.5 rounded-full bg-[#24273A] overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: stockColor }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Audit Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <AuditTimeline entries={auditEntries} />
        )}
      </div>

      {/* Adjustment modal */}
      {adjustingVariant && (
        <AdjustmentModal
          {...adjustingVariant}
          onSave={handleAdjust}
          onClose={() => setAdjustingVariant(null)}
        />
      )}
    </div>
  );
}
