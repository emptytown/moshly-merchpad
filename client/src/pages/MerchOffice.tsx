/**
 * Merch Office — pre-show preparation screen
 * Design: "Neon Ledger" — dark glass cards, Moshly accent colors
 * Features: items editor, show selector, stats summary, past registers
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Minus, Trash2, Edit2, Play, ChevronDown, ChevronUp, Package, Calendar, TrendingUp, X, Check, Zap, ArrowRightLeft, Warehouse, Truck, Sliders, Phone, Mail, UserCheck, UserX, ShoppingBag, Clock, DollarSign, Pencil, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
import { Product, Show, TeamMember, StockAdjustment, getDB } from '../lib/db';
import { cn } from '../lib/utils';
import { RightDrawer } from '../components/RightDrawer';
import TeamSection from '../components/TeamSection';
import { Switch } from '../components/ui/switch';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number, currency = 'EUR') {
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  return `${symbol}${n.toFixed(2)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ADJUST_REASON_LABELS: Record<StockAdjustment['reason'], string> = {
  damaged:                'Damaged',
  theft:                  'Stolen',
  counting_error:         'Recount',
  restock:                'Restocked',
  other:                  'Other',
  transfer_to_road:       'Transfer →Road',
  transfer_to_warehouse:  'Transfer →WH',
};

// ── Show Selector ──────────────────────────────────────────────────────────

interface ShowSelectorProps {
  shows: Show[];
  selectedShowId: string;
  onSelect: (id: string) => void;
  onNewShow: () => void;
  onEdit: (s: Show) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
}

function ShowSelector({ shows, selectedShowId, onSelect, onNewShow, onEdit, onDelete, onActivate }: ShowSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = shows.find(s => s.id === selectedShowId);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 flex-1">
          <Calendar size={16} className="text-primary" />
          {selected ? (
            <div className="flex items-center justify-between flex-1">
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.venue} · {formatDate(selected.date)}</p>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-tighter mr-2">
                Active Sale
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a show</p>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10 shadow-2xl"
          style={{ background: 'var(--popover)', border: '1px solid var(--border)' }}>
          <div className="max-h-60 overflow-y-auto">
            {shows.map(s => (
              <div key={s.id} onClick={() => { onSelect(s.id); setOpen(false); }}
                className={cn('w-full flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-accent/10 transition-colors',
                  s.id === selectedShowId && 'bg-primary/10')}>
                <div className="flex-1 min-w-0 mr-2">
                  <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.venue} · {formatDate(s.date)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); onActivate(s.id); }} 
                    className="p-1.5 rounded-lg text-primary hover:bg-primary/20 transition-colors" title="Activate">
                    <Play size={14} fill="currentColor" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(s); }} 
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} 
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { onNewShow(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-primary hover:bg-accent/10 transition-colors border-t border-border">
            <Plus size={14} /> New Show
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Show Modal ─────────────────────────────────────────────────────────

function NewShowModal({ projectId, initialShow, onSave, onClose }: { projectId: string; initialShow?: Show; onSave: (s: Show) => void; onClose: () => void }) {
  const [name, setName] = useState(initialShow?.name ?? '');
  const [venue, setVenue] = useState(initialShow?.venue ?? '');
  const [city, setCity] = useState(initialShow?.city ?? '');
  const [date, setDate] = useState(initialShow?.date ?? new Date().toISOString().split('T')[0]);

  function handleSave() {
    if (!name.trim() || !venue.trim()) { toast.error('Name and venue required'); return; }
    const show: Show = {
      id: initialShow?.id ?? uuidv4(),
      projectId,
      name: name.trim(),
      venue: venue.trim(),
      city: city.trim() || undefined,
      date,
      status: initialShow?.status ?? 'upcoming',
      createdAt: initialShow?.createdAt ?? new Date().toISOString(),
    };
    onSave(show);
  }

  return (
    <RightDrawer open={true} onClose={onClose} title={initialShow ? "Edit Show" : "New Show"}>
      <div className="min-h-0 overflow-y-auto p-3 space-y-4">
        {[
          { label: 'Show Name', val: name, set: setName, ph: 'Summer Tour 2026' },
          { label: 'Venue', val: venue, set: setVenue, ph: 'Altice Arena' },
          { label: 'City', val: city, set: setCity, ph: 'Lisbon' },
        ].map(({ label, val, set, ph }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
              className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2 p-3 border-t border-border flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground" style={{ border: '1px solid var(--border)' }}>Cancel</button>
        <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
          {initialShow ? "Update Show" : "Save Show"}
        </button>
      </div>
    </RightDrawer>
  );
}

// ── Start Sale Modal ───────────────────────────────────────────────────────

function StartSaleModal({ showId, onStart, onClose }: { showId: string; onStart: (repName: string, stand?: string) => void; onClose: () => void }) {
  const { state } = useMerchPad();
  const [repName, setRepName] = useState(state.repName);
  const [stand, setStand] = useState('');

  return (
    <RightDrawer open={true} onClose={onClose} title="Start Sale Session">
      <div className="min-h-0 overflow-y-auto p-3 space-y-4">
        <p className="text-sm text-muted-foreground">This will snapshot the current stock for your stand. Stock stroke colors will reflect this allocation.</p>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your Name</label>
          <input value={repName} onChange={e => setRepName(e.target.value)} placeholder="João"
            className="w-full px-3 py-2.5 rounded-xl text-sm text-[#E6E7EB] placeholder:text-[#4A4D5E] outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}
            autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Stand / Location (optional)</label>
          <input value={stand} onChange={e => setStand(e.target.value)} placeholder="Stand A"
            className="w-full px-3 py-2.5 rounded-xl text-sm text-[#E6E7EB] placeholder:text-[#4A4D5E] outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }} />
        </div>
      </div>
      <div className="flex gap-2 p-3 border-t border-border flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground" style={{ border: '1px solid var(--border)' }}>Cancel</button>
        <button onClick={() => { if (!repName.trim()) { toast.error('Name required'); return; } onStart(repName.trim(), stand.trim() || undefined); }}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary flex items-center justify-center gap-2">
          <Zap size={14} /> Start Sale
        </button>
      </div>
    </RightDrawer>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────


// ── Past Shows Section ────────────────────────────────────────────────────
interface PastShowsSectionProps {
  shows: Show[];
  symbol: string;
  projectId: string;
  secPastShows: boolean;
  setSecPastShows: (v: (prev: boolean) => boolean) => void;
  expandedPastShow: string | null;
  setExpandedPastShow: (id: string | null) => void;
  pastShowStats: Record<string, { sessions: number; items: number; revenue: number }>;
  setPastShowStats: React.Dispatch<React.SetStateAction<Record<string, { sessions: number; items: number; revenue: number }>>>;
  onDelete: (showId: string) => Promise<void>;
}

async function downloadShowReport(show: Show) {
  const db = await getDB();
  const batches = await db.getAll('tallyBatches');
  const showBatches = batches.filter(b => b.showId === show.id && b.status !== 'voided');
  const rows: string[][] = [['Date', 'Rep', 'Item', 'Qty', 'Unit Price', 'Subtotal', 'Sale Total', 'Shortfall Type']];
  for (const batch of showBatches) {
    for (const item of batch.items) {
      rows.push([
        new Date(batch.confirmedAt).toLocaleString(),
        batch.repName,
        item.variantName,
        String(item.qty),
        item.unitPrice.toFixed(2),
        (item.qty * item.unitPrice).toFixed(2),
        batch.totalPrice.toFixed(2),
        batch.shortfallType ?? '',
      ]);
    }
  }
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${show.name.replace(/\s+/g, '_')}_${show.date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function PastShowsSection({ shows, symbol, projectId, secPastShows, setSecPastShows, expandedPastShow, setExpandedPastShow, pastShowStats, setPastShowStats, onDelete }: PastShowsSectionProps) {
  useEffect(() => {
    if (!shows.length) return;
    async function loadStats() {
      const db = await getDB();
      const allBatches = await db.getAllFromIndex('tallyBatches', 'by-project', projectId);
      const allSessions = await db.getAllFromIndex('sessions', 'by-project', projectId);
      const stats: Record<string, { sessions: number; items: number; revenue: number }> = {};
      for (const show of shows) {
        const showBatches = allBatches.filter(b => b.showId === show.id && b.status !== 'voided');
        const showSessions = allSessions.filter(s => s.showId === show.id);
        stats[show.id] = {
          sessions: showSessions.length,
          items: showBatches.reduce((s, b) => s + b.totalItems, 0),
          revenue: showBatches.reduce((s, b) => s + b.totalPrice, 0),
        };
      }
      setPastShowStats(stats);
    }
    loadStats();
  }, [shows, projectId, setPastShowStats]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button onClick={() => setSecPastShows(v => !v)} className="flex items-center gap-1.5 group">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Shows</p>
          <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secPastShows ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </button>
        {shows.length > 0 && <span className="text-[10px] text-[#7B7F93]">{shows.length} show{shows.length !== 1 ? 's' : ''}</span>}
      </div>
      {secPastShows && (
        <div className="space-y-2">
          {shows.length === 0 ? (
            <div className="mp-card p-6 text-center">
              <Calendar size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-semibold text-muted-foreground">No past shows yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Archived shows will appear here with sales reports</p>
            </div>
          ) : shows.map(show => {
            const isExpanded = expandedPastShow === show.id;
            const stats = pastShowStats[show.id];
            return (
              <div key={show.id} className="mp-card overflow-hidden">
                {/* Header row — div[role=button] to avoid nested button */}
                <div className="p-3 flex items-center justify-between">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedPastShow(isExpanded ? null : show.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedPastShow(isExpanded ? null : show.id); } }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="text-[#7B7F93] flex-shrink-0">{isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{show.name}</p>
                      <p className="text-xs text-[#7B7F93] truncate">{show.venue}{show.city ? ` · ${show.city}` : ''} · {show.date}</p>
                    </div>
                    {!isExpanded && stats && (
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-xs font-bold mp-mono text-green-400">{symbol}{stats.revenue.toFixed(0)}</span>
                        <span className="text-xs text-[#7B7F93]">{stats.items} items</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={() => downloadShowReport(show)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      style={{ border: '1px solid rgba(107,92,255,0.25)' }}
                      title="Download CSV report">
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(show.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#F87171] hover:bg-[rgba(248,113,113,0.12)] transition-colors"
                      style={{ border: '1px solid rgba(248,113,113,0.25)' }}
                      title="Permanently delete show">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                {/* Expanded stats */}
                {isExpanded && (
                  <div className="border-t border-[#24273A] p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg p-2 text-center" style={{ background: 'var(--muted)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Sessions</p>
                        <p className="text-base font-black mp-mono text-foreground">{stats?.sessions ?? '—'}</p>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: 'var(--muted)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Items</p>
                        <p className="text-base font-black mp-mono text-foreground">{stats?.items ?? '—'}</p>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: 'var(--muted)' }}>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Revenue</p>
                        <p className="text-base font-black mp-mono text-green-500">{symbol}{stats?.revenue.toFixed(0) ?? '—'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadShowReport(show)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                      style={{ border: '1px solid rgba(107,92,255,0.2)' }}>
                      <Download size={12} /> Download Report CSV
                    </button>
                    <p className="text-[10px] text-[#4A4D5E] mt-2 text-center">Trash icon permanently removes this show and all its data</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MerchOffice() {
  const [, navigate] = useLocation();
  const { state, saveProduct, deleteProduct, saveShow, deleteShow, startSession, startOneOffSession, adjustStock, transferStock, saveTeamMember, deleteTeamMember, getTeamMemberStats } = useMerchPad();
  const { activeProject } = useProjects();
  const projectId = activeProject?.id ?? 'default';
  const { products, shows, activeSession, isLoading, settings } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';

  const [selectedShowId, setSelectedShowId] = useState(shows.find(s => s.status === 'upcoming')?.id ?? shows[0]?.id ?? '');
  const [editingShow, setEditingShow] = useState<Show | 'new' | null>(null);
  const [confirmDeleteShowId, setConfirmDeleteShowId] = useState<string | null>(null);
  const [confirmDeleteProductId, setConfirmDeleteProductId] = useState<string | null>(null);
  const [confirmSuspendProductId, setConfirmSuspendProductId] = useState<string | null>(null);
  const [confirmActivateShowId, setConfirmActivateShowId] = useState<string | null>(null);
  const [showStartSale, setShowStartSale] = useState(false);
  const [showOneOff, setShowOneOff] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  // Inline transfer panel state — one product open at a time
  const [transferProductId, setTransferProductId] = useState<string | null>(null);
  const [transferDeltas, setTransferDeltas] = useState<Record<string, number>>({});
  // Inline adjust panel state — one product open at a time
  const [adjustProductId, setAdjustProductId] = useState<string | null>(null);
  const [adjustWHDeltas, setAdjustWHDeltas] = useState<Record<string, number>>({});
  const [adjustRoadDeltas, setAdjustRoadDeltas] = useState<Record<string, number>>({});
  const [adjustReason, setAdjustReason] = useState<StockAdjustment['reason']>('counting_error');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustAdjusterName, setAdjustAdjusterName] = useState('');
  // Collapsible section state (all open by default)
  const [secShow, setSecShow] = useState(true);
  const [secProducts, setSecProducts] = useState(true);
  const [secPastShows, setSecPastShows] = useState(true);
  const [expandedPastShow, setExpandedPastShow] = useState<string | null>(null);
  const [pastShowStats, setPastShowStats] = useState<Record<string, { sessions: number; items: number; revenue: number }>>({});
  const [secTeam, setSecTeam] = useState(true);
  // Team member drawer
  const [editingMember, setEditingMember] = useState<TeamMember | 'new' | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', email: '', active: true });
  const [memberStats, setMemberStats] = useState<{ shifts: number; hoursWorked: number; totalItems: number; totalRevenue: number } | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<string | null>(null);
  function openTransferPanel(productId: string, variants: typeof products[0]['variants']) {
    closeAdjustPanel();
    setTransferProductId(productId);
    const initialDeltas: Record<string, number> = {};
    variants.forEach(v => { initialDeltas[v.id] = 0; });
    setTransferDeltas(initialDeltas);
  }

  function closeTransferPanel() {
    setTransferProductId(null);
    setTransferDeltas({});
  }

  function openAdjustPanel(productId: string, variants: typeof products[0]['variants']) {
    closeTransferPanel();
    setAdjustProductId(productId);
    const zeroDeltas: Record<string, number> = {};
    variants.forEach(v => { zeroDeltas[v.id] = 0; });
    setAdjustWHDeltas({ ...zeroDeltas });
    setAdjustRoadDeltas({ ...zeroDeltas });
    setAdjustReason('counting_error');
    setAdjustNotes('');
    setAdjustAdjusterName(activeSession?.repName ?? state.repName ?? '');
  }

  function closeAdjustPanel() {
    setAdjustProductId(null);
    setAdjustWHDeltas({});
    setAdjustRoadDeltas({});
    setAdjustNotes('');
    setAdjustAdjusterName('');
  }

  function changeWHAdjustDelta(variantId: string, warehouseStock: number, direction: 1 | -1) {
    setAdjustWHDeltas(prev => {
      const next = (prev[variantId] ?? 0) + direction;
      if (next < -warehouseStock) return prev;
      return { ...prev, [variantId]: next };
    });
  }

  function changeRoadAdjustDelta(variantId: string, roadStock: number, direction: 1 | -1) {
    setAdjustRoadDeltas(prev => {
      const next = (prev[variantId] ?? 0) + direction;
      if (next < -roadStock) return prev;
      return { ...prev, [variantId]: next };
    });
  }

  async function confirmAdjustments(product: typeof products[0]) {
    const hasAnyDelta = product.variants.some(
      v => (adjustWHDeltas[v.id] ?? 0) !== 0 || (adjustRoadDeltas[v.id] ?? 0) !== 0
    );
    if (!hasAnyDelta) { toast('No adjustments to apply'); return; }
    if (!adjustAdjusterName.trim()) { toast.error('Adjuster name is required'); return; }
    for (const variant of product.variants) {
      const whDelta = adjustWHDeltas[variant.id] ?? 0;
      const roadDelta = adjustRoadDeltas[variant.id] ?? 0;
      if (whDelta !== 0) {
        await adjustStock(variant.id, product.id, variant.name, whDelta, adjustReason, adjustNotes.trim() || undefined, adjustAdjusterName.trim(), 'warehouse');
      }
      if (roadDelta !== 0) {
        await adjustStock(variant.id, product.id, variant.name, roadDelta, adjustReason, adjustNotes.trim() || undefined, adjustAdjusterName.trim(), 'road');
      }
    }
    toast.success('Stock adjusted');
    closeAdjustPanel();
  }

  function adjustTransferDelta(variantId: string, warehouseStock: number, roadStock: number, direction: 1 | -1) {
    setTransferDeltas(prev => {
      const current = prev[variantId] ?? 0;
      const next = current + direction;
      if (next > warehouseStock) return prev;   // can't move more than WH has
      if (next < -roadStock) return prev;        // can't move more than Road has
      return { ...prev, [variantId]: next };
    });
  }

  async function confirmTransfer(product: typeof products[0]) {
    const variantsWithDeltas = product.variants.filter(v => (transferDeltas[v.id] ?? 0) !== 0);
    if (variantsWithDeltas.length === 0) { toast('No units to transfer'); return; }
    for (const variant of variantsWithDeltas) {
      const delta = transferDeltas[variant.id];
      const direction = delta > 0 ? 'to_road' : 'to_warehouse';
      await transferStock(variant.id, product.id, variant.name, direction, Math.abs(delta));
    }
    toast.success('Stock transferred');
    closeTransferPanel();
  }

  useEffect(() => {
    if (!selectedShowId && shows.length > 0) {
      setSelectedShowId(shows.find(s => s.status === 'upcoming')?.id ?? shows[0].id);
    }
  }, [shows, selectedShowId]);

  // Stats
  const totalStockValue = products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + ((v.warehouseStock ?? 0) + (v.roadStock ?? v.currentStock)) * v.price, 0), 0);

  const [allTimeSales, setAllTimeSales] = useState<number | null>(null);
  const [lastGigRevenue, setLastGigRevenue] = useState<number | null>(null);

  useEffect(() => {
    async function loadSalesStats() {
      const db = await getDB();
      const batches = await db.getAllFromIndex('tallyBatches', 'by-project', projectId);
      const active = batches.filter(b => b.status !== 'voided');
      setAllTimeSales(active.reduce((s, b) => s + b.totalPrice, 0));

      const completedShows = shows
        .filter(s => s.status === 'completed' || s.status === 'archived')
        .sort((a, b) => b.date.localeCompare(a.date));
      if (completedShows.length > 0) {
        const lastShow = completedShows[0];
        const showBatches = active.filter(b => b.showId === lastShow.id);
        setLastGigRevenue(showBatches.reduce((s, b) => s + b.totalPrice, 0));
      } else {
        setLastGigRevenue(0);
      }
    }
    loadSalesStats();
  }, [shows, projectId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading MerchPad…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden px-4 pt-4 pb-3" style={{ minHeight: 120 }}>
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none text-foreground" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="merch-bg-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                {/* t-shirt */}
                <path d="M6 10 L2 18 L9 20 L9 32 L21 32 L21 20 L28 18 L24 10 C21 14 15 14 11 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
                {/* vinyl */}
                <circle cx="62" cy="25" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <circle cx="62" cy="25" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                {/* tote bag */}
                <path d="M34 56 L32 70 L48 70 L46 56 Z M37 56 Q37 51 40 51 Q43 51 43 56" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#merch-bg-pattern)"/>
          </svg>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1 opacity-80">Merch Office</p>
          <h1 className="text-2xl font-black text-foreground leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Pre-Show Prep
          </h1>
        </div>
      </div>

      <div className="px-4 space-y-[34px] -mt-2">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'All-time Sales', value: allTimeSales !== null ? formatCurrency(allTimeSales, currency) : '—', sub: 'total revenue' },
            { label: 'Last Gig', value: lastGigRevenue !== null ? formatCurrency(lastGigRevenue, currency) : '—', sub: shows.some(s => s.status === 'completed' || s.status === 'archived') ? 'prev show' : 'no shows yet' },
            { label: 'In Stock', value: formatCurrency(totalStockValue, currency), sub: 'at retail' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="mp-card p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 leading-tight">{label}</p>
              <p className="text-lg font-black text-foreground leading-none mp-mono">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Show selector */}
        <div>
          <button onClick={() => setSecShow(v => !v)} className="flex items-center justify-between w-full mb-1 group">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Show</p>
            <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secShow ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
          </button>
          {secShow && <ShowSelector
            shows={shows}
            selectedShowId={selectedShowId}
            onSelect={setSelectedShowId}
            onNewShow={() => setEditingShow('new')}
            onEdit={setEditingShow}
            onDelete={setConfirmDeleteShowId}
            onActivate={setConfirmActivateShowId}
          />}
        </div>

        {/* Start Sale CTA */}
        {!activeSession ? (
          <div className="flex gap-2">
            <button
              onClick={() => { if (!selectedShowId) { toast.error('Select a show first'); return; } setShowStartSale(true); }}
              className="flex-1 py-4 rounded-2xl text-base font-black text-white mp-btn-primary flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 24px rgba(107,92,255,0.3)' }}>
              <Zap size={18} />
              Start Sale Session
            </button>
            <button
              onClick={() => setShowOneOff(true)}
              className="py-4 px-4 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-1.5 shrink-0"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#FBBF24' }}
              title="OneOff Sale">
              <Truck size={16} />
              <span className="hidden sm:inline">OneOff</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(107,92,255,0.1)', border: '1px solid rgba(107,92,255,0.3)' }}>
            <div>
              <p className="text-sm font-bold text-[#7C6DFF]">Session Active</p>
              <p className="text-xs text-[#A4A7B5]">{activeSession.repName}{activeSession.standName ? ` · ${activeSession.standName}` : ''}</p>
              {(() => {
                const activeShow = shows.find(s => s.id === activeSession.showId);
                return activeShow ? (
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'rgba(124,109,255,0.7)' }}>
                    <Calendar size={10} />{activeShow.name} · {activeShow.venue}
                  </p>
                ) : null;
              })()}
            </div>
            <button onClick={() => navigate('/tally')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white mp-btn-primary flex items-center gap-1.5">
              <Zap size={14} /> Go to Tally
            </button>
          </div>
        )}

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSecProducts(v => !v)} className="flex items-center gap-1.5 group">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Products {products.length > 0 && <span className="font-normal normal-case">({products.length} item{products.length !== 1 ? 's' : ''})</span>}
              </p>
              <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secProducts ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
            </button>
            <button onClick={() => navigate('/new-product')}
              className="flex items-center gap-1 text-xs font-semibold text-[#7C6DFF] hover:text-[#6B5CFF] transition-colors">
              <Plus size={13} /> Add Product
            </button>
          </div>

          {secProducts && <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="mp-card overflow-hidden">
                <button
                  onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  className={cn("w-full flex items-center justify-between p-3", product.status === 'suspended' && "opacity-50 grayscale-[0.5]")}>
                  <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--primary)/10' }}>
                      <Package size={14} className="text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{product.name}</p>
                        {product.status === 'suspended' && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-tight">
                            <UserX size={8} /> Suspended - Hidden from Sales
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#7B7F93]">{product.variants.length} variants · {product.category ?? 'Uncategorised'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#E6E7EB] mp-mono">
                      {product.variants.reduce((s, v) => s + (v.warehouseStock ?? 0) + (v.roadStock ?? v.currentStock), 0)} units
                    </span>
                    {expandedProduct === product.id ? <ChevronUp size={14} className="text-[#7B7F93]" /> : <ChevronDown size={14} className="text-[#7B7F93]" />}
                  </div>
                </button>

                {expandedProduct === product.id && (
                  <div className="border-t border-[#24273A]">
                    {/* Variant table — Variant | Price | WH | Road */}
                    <div className={cn("p-3 space-y-1.5", product.status === 'suspended' && "opacity-50 grayscale-[0.5]")}>
                      <div className="flex items-center justify-between px-2 pb-1">
                        <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">Variant</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider w-12 text-right">Price</span>
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider w-8 text-right">WH</span>
                          <span className="text-[10px] font-semibold text-green-500 uppercase tracking-wider w-8 text-right">Road</span>
                        </div>
                      </div>
                      {product.variants.map(variant => (
                        <div key={variant.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: 'var(--background)', border: '2px solid var(--border)' }}>
                          <span className="text-sm text-muted-foreground truncate flex-1 mr-2">{variant.name}</span>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-muted-foreground mp-mono w-12 text-right">{formatCurrency(variant.price, currency)}</span>
                            <span className="text-sm font-bold mp-mono text-primary w-8 text-right">{variant.warehouseStock ?? 0}</span>
                            <span className={cn('text-sm font-bold mp-mono w-8 text-right',
                              (variant.roadStock ?? variant.currentStock) <= 0 ? 'text-destructive' :
                              (variant.roadStock ?? variant.currentStock) / (variant.initialStock || 1) <= 0.1 ? 'text-destructive' :
                              (variant.roadStock ?? variant.currentStock) / (variant.initialStock || 1) <= 0.3 ? 'text-orange-500' :
                              'text-green-500')}>
                              {variant.roadStock ?? variant.currentStock}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* WH ↔ Road summary */}
                    <div className={cn("mx-3 mb-2 p-2 rounded-lg flex items-center justify-between text-xs", product.status === 'suspended' && "opacity-50 grayscale-[0.5]")}
                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-1.5 text-primary">
                        <Warehouse size={11} />
                        <span>WH: {product.variants.reduce((s, v) => s + (v.warehouseStock ?? 0), 0)}</span>
                      </div>
                      <ArrowRightLeft size={10} className="text-muted-foreground/30" />
                      <div className="flex items-center gap-1.5 text-green-500">
                        <Truck size={11} />
                        <span>Road: {product.variants.reduce((s, v) => s + (v.roadStock ?? v.currentStock), 0)}</span>
                      </div>
                    </div>

                    {/* Edit / Suspend / Delete */}
                    <div className="flex gap-2 px-3 pb-2">
                      <button onClick={() => navigate(`/edit-product?id=${product.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                        style={{ border: '1px solid var(--border)' }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      {product.status === 'suspended' ? (
                        <button onClick={async () => {
                          const updated = { ...product, status: 'active' as const, updatedAt: new Date().toISOString() };
                          await saveProduct(updated);
                          toast.success(`${product.name} activated`);
                        }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-green-500 hover:bg-green-500/10 transition-colors"
                          style={{ border: '1px solid var(--border)' }}>
                          <Check size={12} /> Activate
                        </button>
                      ) : (
                        <button onClick={() => setConfirmSuspendProductId(product.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-orange-500 hover:bg-orange-500/10 transition-colors"
                          style={{ border: '1px solid var(--border)' }}>
                          <UserX size={12} /> Suspend
                        </button>
                      )}
                      <button onClick={() => setConfirmDeleteProductId(product.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                        style={{ border: '1px solid var(--border)' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>

                    {/* Transfer + Adjust — shared row */}
                    <div className="flex gap-2 px-3 pb-3">
                      <button
                        onClick={() => transferProductId === product.id ? closeTransferPanel() : openTransferPanel(product.id, product.variants)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={transferProductId === product.id
                          ? { background: 'rgba(107,92,255,0.15)', border: '1px solid rgba(107,92,255,0.4)', color: '#7C6DFF' }
                          : { background: 'rgba(107,92,255,0.06)', border: '1px solid rgba(107,92,255,0.2)', color: '#7C6DFF' }}>
                        <ArrowRightLeft size={13} />
                        Transfer
                        {transferProductId === product.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      <button
                        onClick={() => adjustProductId === product.id ? closeAdjustPanel() : openAdjustPanel(product.id, product.variants)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
                        style={adjustProductId === product.id
                          ? { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#FBBF24' }
                          : { background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24' }}>
                        <Sliders size={13} />
                        Adjust
                        {adjustProductId === product.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>

                    {/* Inline transfer panel */}
                    {transferProductId === product.id && (
                      <div className="border-t border-[#24273A] px-3 pb-3 pt-2 space-y-2 animate-fade-in">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                          + moves WH → Road · − moves Road → WH
                        </p>
                        {product.variants.map(variant => {
                          const warehouseStock = variant.warehouseStock ?? 0;
                          const roadStock = variant.roadStock ?? variant.currentStock;
                          const delta = transferDeltas[variant.id] ?? 0;
                          return (
                            <div key={variant.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                              <span className="text-xs text-muted-foreground flex-1 truncate">{variant.name}</span>
                              <span className="text-xs font-bold mp-mono text-primary w-10 text-right flex-shrink-0">WH {warehouseStock}</span>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => adjustTransferDelta(variant.id, warehouseStock, roadStock, -1)}
                                  disabled={delta <= -roadStock}
                                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 transition-colors"
                                  style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                  <Minus size={10} className="text-muted-foreground" />
                                </button>
                                <span className={cn('text-sm font-black mp-mono w-8 text-center',
                                  delta > 0 ? 'text-green-400' : delta < 0 ? 'text-amber-400' : 'text-muted-foreground')}>
                                  {delta > 0 ? `+${delta}` : delta === 0 ? '0' : delta}
                                </span>
                                <button
                                  onClick={() => adjustTransferDelta(variant.id, warehouseStock, roadStock, 1)}
                                  disabled={delta >= warehouseStock}
                                  className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 transition-colors"
                                  style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                  <Plus size={10} className="text-muted-foreground" />
                                </button>
                              </div>
                              <span className="text-xs font-bold mp-mono text-green-500 w-12 text-right flex-shrink-0">Road {roadStock}</span>
                            </div>
                          );
                        })}
                        <button
                          onClick={() => confirmTransfer(product)}
                          className="w-full py-2.5 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5 mp-btn-primary"
                          style={{ boxShadow: '0 0 16px rgba(107,92,255,0.25)' }}>
                          <ArrowRightLeft size={13} /> Confirm Transfer
                        </button>
                      </div>
                    )}

                    {/* Inline adjust panel */}
                    {adjustProductId === product.id && (
                      <div className="border-t border-[#24273A] px-3 pb-3 pt-2 space-y-3 animate-fade-in">

                        {/* Per-variant: WH + Road delta controls side by side */}
                        {product.variants.map(variant => {
                          const warehouseStock = variant.warehouseStock ?? 0;
                          const roadStock = variant.roadStock ?? variant.currentStock;
                          const whDelta = adjustWHDeltas[variant.id] ?? 0;
                          const roadDelta = adjustRoadDeltas[variant.id] ?? 0;
                          return (
                            <div key={variant.id} className="rounded-lg overflow-hidden"
                              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                              {/* Variant name header */}
                              <div className="px-2 pt-1.5 pb-1">
                                <span className="text-xs font-semibold text-foreground truncate block">{variant.name}</span>
                              </div>
                              {/* WH + Road controls */}
                              <div className="flex items-center divide-x divide-border">
                                {/* Warehouse column */}
                                <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5">
                                  <Warehouse size={15} className="text-primary flex-shrink-0" />
                                  <span className="text-[15px] font-bold mp-mono text-primary flex-shrink-0">{warehouseStock}</span>
                                  <div className="flex items-center gap-0.5 ml-auto">
                                    <button
                                      onClick={() => changeWHAdjustDelta(variant.id, warehouseStock, -1)}
                                      disabled={whDelta <= -warehouseStock}
                                      className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 transition-colors"
                                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                      <Minus size={9} className="text-muted-foreground" />
                                    </button>
                                    <span className={cn('text-xs font-black mp-mono w-7 text-center',
                                      whDelta > 0 ? 'text-primary' : whDelta < 0 ? 'text-red-400' : 'text-muted-foreground/40')}>
                                      {whDelta > 0 ? `+${whDelta}` : whDelta === 0 ? '·' : whDelta}
                                    </span>
                                    <button
                                      onClick={() => changeWHAdjustDelta(variant.id, warehouseStock, 1)}
                                      className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                      <Plus size={9} className="text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                                {/* Road column */}
                                <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5">
                                  <Truck size={15} className="text-green-500 flex-shrink-0" />
                                  <span className="text-[15px] font-bold mp-mono text-green-500 flex-shrink-0">{roadStock}</span>
                                  <div className="flex items-center gap-0.5 ml-auto">
                                    <button
                                      onClick={() => changeRoadAdjustDelta(variant.id, roadStock, -1)}
                                      disabled={roadDelta <= -roadStock}
                                      className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 transition-colors"
                                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                      <Minus size={9} className="text-muted-foreground" />
                                    </button>
                                    <span className={cn('text-xs font-black mp-mono w-7 text-center',
                                      roadDelta > 0 ? 'text-green-400' : roadDelta < 0 ? 'text-red-400' : 'text-muted-foreground/40')}>
                                      {roadDelta > 0 ? `+${roadDelta}` : roadDelta === 0 ? '·' : roadDelta}
                                    </span>
                                    <button
                                      onClick={() => changeRoadAdjustDelta(variant.id, roadStock, 1)}
                                      className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                      <Plus size={9} className="text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Reason pills */}
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Reason</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['damaged', 'theft', 'counting_error', 'restock', 'other'] as const).map(r => (
                              <button key={r} onClick={() => setAdjustReason(r)}
                                className={cn('py-1.5 rounded-lg text-[10px] font-semibold transition-all',
                                  adjustReason === r ? 'text-amber-400' : 'text-muted-foreground')}
                                style={adjustReason === r
                                  ? { background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }
                                  : { background: 'var(--muted)', border: '1px solid var(--border)' }}>
                                {ADJUST_REASON_LABELS[r]}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Notes */}
                        <input
                          value={adjustNotes}
                          onChange={e => setAdjustNotes(e.target.value)}
                          placeholder="Notes (optional)…"
                          className="w-full px-3 py-2 rounded-lg text-xs text-foreground border focus:outline-none placeholder:text-muted-foreground transition-colors"
                          style={{ background: 'var(--background)', borderColor: 'var(--border)' }}
                        />

                        {/* Adjuster signature */}
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                          style={{ background: 'rgba(251,191,36,0.05)', border: `1px solid ${adjustAdjusterName.trim() ? 'rgba(251,191,36,0.4)' : 'rgba(251,191,36,0.2)'}` }}>
                          <UserCheck size={11} className="text-amber-400 flex-shrink-0" />
                          <input
                            value={adjustAdjusterName}
                            onChange={e => setAdjustAdjusterName(e.target.value)}
                            placeholder="Adjuster name (required) *"
                            className="flex-1 bg-transparent text-xs text-foreground focus:outline-none placeholder:text-muted-foreground/60"
                          />
                          {!adjustAdjusterName.trim() && (
                            <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />
                          )}
                        </div>

                        <button
                          onClick={() => confirmAdjustments(product)}
                          className="w-full py-2.5 rounded-xl text-xs font-black text-white flex items-center justify-center gap-1.5"
                          style={{ background: 'linear-gradient(135deg, #FBBF24, #D97706)', boxShadow: '0 0 16px rgba(251,191,36,0.2)' }}>
                          <Sliders size={13} /> Confirm Adjustment
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {products.length === 0 && (
              <div className="mp-card p-8 text-center">
                <Package size={32} className="text-[#7B7F93] mx-auto mb-3" />
                <p className="text-sm font-semibold text-[#A4A7B5]">No products yet</p>
                <p className="text-xs text-[#7B7F93] mt-1">Add your first product to get started</p>
              </div>
            )}
          </div>}
        </div>

        {/* Team */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSecTeam(v => !v)} className="flex items-center gap-1.5 group">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</p>
              <span className="text-xs text-[#7B7F93] ml-1">· {state.teamMembers.filter(m => m.active).length} active</span>
              <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors ml-1">{secTeam ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
            </button>
            <button
              onClick={() => { setEditingMember('new'); setMemberForm({ name: '', phone: '', email: '', active: true }); setMemberStats(null); }}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
              <Plus size={13} /> Add Member
            </button>
          </div>
          {secTeam && (
            <div className="space-y-4">
              {state.teamMembers.filter(m => m.active).length > 0
                ? <TeamSection />
                : <div className="mp-card p-6 text-center">
                    <ShoppingBag size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">No active members</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Add members to track personal sales stats</p>
                  </div>
              }
            </div>
          )}
        </div>

        {/* Past shows summary */}
        <PastShowsSection
          shows={shows.filter(s => s.status === 'completed' || s.status === 'archived')}
          symbol={symbol}
          projectId={projectId}
          secPastShows={secPastShows}
          setSecPastShows={setSecPastShows}
          expandedPastShow={expandedPastShow}
          setExpandedPastShow={setExpandedPastShow}
          pastShowStats={pastShowStats}
          setPastShowStats={setPastShowStats}
          onDelete={async (showId) => {
          setConfirmDeleteShowId(showId);
        }}
        />

        <div className="h-4" />
      </div>

      {/* Member Drawer */}
      {editingMember !== null && (
        <RightDrawer
          open={true}
          onClose={() => setEditingMember(null)}
          title={editingMember === 'new' ? 'New Team Member' : 'Edit Member'}
          subtitle={editingMember !== 'new' ? editingMember.name : 'Fill in the details below'}
        >
          <div className="min-h-0 overflow-y-auto">
            {/* Stats summary — only when editing existing member */}
            {editingMember !== 'new' && (
              <div className="px-4 pt-4 pb-2">
                {memberStats ? (
                  <div className="grid grid-cols-4 gap-2 mb-1">
                    {[
                      { label: 'Shifts', value: String(memberStats.shifts), icon: <ShoppingBag size={11}/>, color: '#7C6DFF' },
                      { label: 'Hours', value: memberStats.hoursWorked > 0 ? memberStats.hoursWorked.toFixed(1) : '—', icon: <Clock size={11}/>, color: '#00E5FF' },
                      { label: 'Items', value: memberStats.totalItems > 0 ? String(memberStats.totalItems) : '—', icon: <TrendingUp size={11}/>, color: '#4ADE80' },
                      { label: 'Revenue', value: memberStats.totalRevenue > 0 ? `${symbol}${Math.round(memberStats.totalRevenue)}` : '—', icon: <DollarSign size={11}/>, color: '#FBBF24' },
                    ].map(s => (
                      <div key={s.label} className="flex flex-col items-center justify-center py-2 rounded-lg gap-0.5"
                        style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                        <span style={{ color: s.color }}>{s.icon}</span>
                        <span className="text-sm font-black mp-mono" style={{ color: s.color }}>{s.value}</span>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 mb-1">
                    {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--muted)' }} />)}
                  </div>
                )}
                {/* Outstanding debt row */}
                {(editingMember as TeamMember).totalDebt && (editingMember as TeamMember).totalDebt! > 0 ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg mt-1"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <span className="text-xs font-semibold text-[#F87171]">Outstanding Debt</span>
                    <span className="text-sm font-black mp-mono text-[#F87171]">
                      −{symbol}{(editingMember as TeamMember).totalDebt!.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Name *</label>
                <input value={memberForm.name} onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name" autoFocus
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground border focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  <Phone size={10} className="inline mr-1" />Phone
                </label>
                <input value={memberForm.phone} onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555 000 0000" type="tel"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground border focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  <Mail size={10} className="inline mr-1" />Email
                </label>
                <input value={memberForm.email} onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com" type="email"
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-foreground placeholder:text-muted-foreground border focus:outline-none focus:ring-1 focus:ring-primary"
                  style={{ background: 'var(--input)', borderColor: 'var(--border)' }} />
              </div>
              <div className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2">
                  {memberForm.active ? <UserCheck size={14} className="text-green-500" /> : <UserX size={14} className="text-muted-foreground" />}
                  <span className="text-sm text-foreground">Active</span>
                  <span className="text-xs text-muted-foreground">{memberForm.active ? 'On roster' : 'Hidden'}</span>
                </div>
                <Switch
                  checked={memberForm.active}
                  onCheckedChange={val => setMemberForm(f => ({ ...f, active: val }))}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            {editingMember !== 'new' && (
              <button onClick={() => setConfirmDeleteMember(editingMember.id)}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                style={{ border: '1px solid var(--border)' }}>
                <Trash2 size={18} />
              </button>
            )}
            <button onClick={() => setEditingMember(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground"
              style={{ border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!memberForm.name.trim()) { toast.error('Name is required'); return; }
                const now = new Date().toISOString();
                const member: TeamMember = editingMember === 'new'
                  ? { id: uuidv4(), name: memberForm.name.trim(), phone: memberForm.phone || undefined, email: memberForm.email || undefined, active: memberForm.active, createdAt: now, updatedAt: now }
                  : { ...editingMember, name: memberForm.name.trim(), phone: memberForm.phone || undefined, email: memberForm.email || undefined, active: memberForm.active, updatedAt: now };
                await saveTeamMember(member);
                toast.success(editingMember === 'new' ? `${member.name} added` : `${member.name} updated`);
                setEditingMember(null);
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
              {editingMember === 'new' ? 'Add Member' : 'Save Changes'}
            </button>
          </div>
        </RightDrawer>
      )}

      {/* Confirm delete member dialog */}
      {confirmDeleteMember && (() => {
        const m = state.teamMembers.find(x => x.id === confirmDeleteMember);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <div className="mp-card w-full max-w-xs p-6 shadow-2xl border-destructive/20 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 mx-auto">
                <Trash2 size={24} className="text-destructive" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">Remove {m?.name}?</p>
              <p className="text-xs text-muted-foreground mb-6">This only removes the team member record. Historical sales data is preserved.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteMember(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={async () => {
                  await deleteTeamMember(confirmDeleteMember);
                  toast.success('Team member removed');
                  setConfirmDeleteMember(null);
                  setEditingMember(null);
                }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modals */}
      {editingShow !== null && (
        <NewShowModal
          projectId={projectId}
          initialShow={editingShow !== 'new' ? editingShow : undefined}
          onSave={async (s) => {
            await saveShow(s);
            if (editingShow === 'new') setSelectedShowId(s.id);
            setEditingShow(null);
            toast.success(editingShow === 'new' ? 'Show added' : 'Show updated');
          }}
          onClose={() => setEditingShow(null)}
        />
      )}

      {confirmDeleteProductId && (() => {
        const p = products.find(x => x.id === confirmDeleteProductId);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <div className="mp-card w-full max-w-xs p-6 shadow-2xl border-destructive/20 text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 mx-auto">
                <Trash2 size={24} className="text-destructive" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">Delete {p?.name}?</p>
              <p className="text-xs text-muted-foreground mb-6">This will permanently remove the product and all its variants. This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDeleteProductId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={async () => {
                  if (p) await deleteProduct(p.id);
                  setConfirmDeleteProductId(null);
                  toast.success('Product deleted');
                }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmSuspendProductId && (() => {
        const p = products.find(x => x.id === confirmSuspendProductId);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <div className="mp-card w-full max-w-xs p-6 shadow-2xl border-orange-500/20 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 mx-auto">
                <UserX size={24} className="text-orange-500" />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">Suspend {p?.name}?</p>
              <p className="text-xs text-muted-foreground mb-6">Suspended products are hidden from the sales screen but their stock is preserved.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmSuspendProductId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={async () => {
                  if (p) {
                    const updated = { ...p, status: 'suspended' as const, updatedAt: new Date().toISOString() };
                    await saveProduct(updated);
                    toast.success(`${p.name} suspended`);
                  }
                  setConfirmSuspendProductId(null);
                }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                  Suspend
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {confirmDeleteShowId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="mp-card w-full max-w-xs p-6 shadow-2xl border-destructive/20">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 mx-auto">
              <Trash2 size={24} className="text-destructive" />
            </div>
            <p className="text-center text-sm font-bold text-foreground mb-1">Delete this show?</p>
            <p className="text-center text-xs text-muted-foreground mb-6">Historical data will be preserved, but the show will be removed from lists.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteShowId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={async () => {
                await deleteShow(confirmDeleteShowId);
                if (selectedShowId === confirmDeleteShowId) {
                  const remaining = shows.filter(s => s.id !== confirmDeleteShowId);
                  setSelectedShowId(remaining.find(s => s.status === 'upcoming')?.id ?? remaining[0]?.id ?? '');
                }
                setConfirmDeleteShowId(null);
                toast.success('Show deleted');
              }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-destructive hover:bg-destructive/90 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmActivateShowId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="mp-card w-full max-w-xs p-6 shadow-2xl border-primary/20 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 mx-auto">
              <Play size={24} className="text-primary" fill="currentColor" />
            </div>
            <p className="text-sm font-bold text-foreground mb-1">Activate this show?</p>
            <p className="text-xs text-muted-foreground mb-6">All subsequent sales will be linked to this show's account.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmActivateShowId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => {
                setSelectedShowId(confirmActivateShowId);
                setConfirmActivateShowId(null);
                toast.success('Show activated');
              }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showStartSale && (
        <StartSaleModal
          showId={selectedShowId}
          onStart={async (repName, stand) => {
            await startSession(selectedShowId, repName, stand);
            setShowStartSale(false);
            toast.success('Sale session started!');
            navigate('/tally');
          }}
          onClose={() => setShowStartSale(false)}
        />
      )}
      {showOneOff && (
        <OneOffModal
          onStart={async (repName) => {
            await startOneOffSession(repName);
            setShowOneOff(false);
            toast.success('OneOff Sale started!');
            navigate('/tally');
          }}
          onClose={() => setShowOneOff(false)}
        />
      )}

    </div>
  );
}

// ── OneOff Sale Modal ──────────────────────────────────────────────────────

function OneOffModal({ onStart, onClose }: { onStart: (repName: string) => Promise<void>; onClose: () => void }) {
  const [repName, setRepName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    if (!repName.trim()) { toast.error('Enter your name'); return; }
    setLoading(true);
    try { await onStart(repName.trim()); } finally { setLoading(false); }
  }

  return (
    <RightDrawer open={true} onClose={onClose} title="Quick Sale" subtitle="OneOff — no show required">
      <div className="min-h-0 overflow-y-auto p-3 space-y-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.2)' }}>
          <Truck size={14} className="text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-300">Sale is logged in the OneOff register</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider block mb-1.5">Rep Name *</label>
          <input
            type="text"
            value={repName}
            onChange={e => setRepName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="Your name"
            className="w-full px-3 py-2.5 rounded-xl text-sm text-[#E6E7EB] placeholder:text-[#4A4D5E] outline-none"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}
            autoFocus
          />
        </div>
        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl text-base font-black text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg,#d97706,#f59e0b)', boxShadow: '0 0 20px rgba(217,119,6,0.3)' }}>
          {loading ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <Truck size={18} />}
          Start OneOff Sale
        </button>
      </div>
    </RightDrawer>
  );
}
