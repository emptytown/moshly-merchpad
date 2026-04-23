/**
 * Detail Info — post-show analysis screen
 * Design: "Neon Ledger" — audit trail timeline, stock adjustments, CSV export
 * Features: item detail, audit trail, manual stock adjustment, CSV export
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Download, ChevronDown, ChevronUp, Sliders, Clock, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { AuditEntry, getDB } from '../lib/db';
import { cn } from '../lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `€${n.toFixed(2)}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  tally_confirmed: { label: 'Sale', color: '#4ADE80' },
  tally_voided: { label: 'Voided', color: '#F87171' },
  stock_adjusted: { label: 'Adjustment', color: '#FBBF24' },
  session_started: { label: 'Session Start', color: '#6B5CFF' },
  session_ended: { label: 'Session End', color: '#7B7F93' },
  tally_undo: { label: 'Undo', color: '#F87171' },
};

// ── Stock Adjustment Modal ─────────────────────────────────────────────────

interface AdjustmentModalProps {
  variantId: string;
  productId: string;
  variantName: string;
  currentStock: number;
  onSave: (delta: number, reason: 'damaged' | 'theft' | 'counting_error' | 'restock' | 'other', notes: string) => void;
  onClose: () => void;
}

function AdjustmentModal({ variantId, productId, variantName, currentStock, onSave, onClose }: AdjustmentModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('remove');
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<'damaged' | 'theft' | 'counting_error' | 'restock' | 'other'>('counting_error');
  const [notes, setNotes] = useState('');

  const delta = mode === 'add' ? parseInt(qty) || 0 : -(parseInt(qty) || 0);
  const newStock = Math.max(0, currentStock + delta);

  function handleSave() {
    if (!qty || parseInt(qty) <= 0) { toast.error('Enter a valid quantity'); return; }
    onSave(delta, reason, notes);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.9)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid #2D3048' }}>
        <div className="flex items-center justify-between p-4 border-b border-[#24273A]">
          <div>
            <h2 className="text-base font-bold text-[#E6E7EB]">Stock Adjustment</h2>
            <p className="text-xs text-[#7B7F93]">{variantName}</p>
          </div>
          <button onClick={onClose} className="text-[#7B7F93] hover:text-[#E6E7EB] p-1">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #2D3048' }}>
            {(['remove', 'add'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={cn('flex-1 py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5',
                  mode === m ? 'text-white' : 'text-[#7B7F93]')}
                style={mode === m ? { background: m === 'remove' ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)' } : {}}>
                {m === 'remove' ? <><TrendingDown size={14} /> Remove</> : <><TrendingUp size={14} /> Add</>}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Quantity</label>
            <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none text-center text-lg font-bold" />
          </div>

          {/* Stock preview */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: 'rgba(14,15,20,0.5)' }}>
            <span className="text-xs text-[#7B7F93]">Current → New</span>
            <span className="text-sm font-bold mp-mono">
              <span className="text-[#A4A7B5]">{currentStock}</span>
              <span className="text-[#7B7F93] mx-1">→</span>
              <span className={newStock < currentStock ? 'text-[#F87171]' : 'text-[#4ADE80]'}>{newStock}</span>
            </span>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Reason</label>
            <div className="grid grid-cols-2 gap-2">
              {(['damaged', 'theft', 'counting_error', 'restock', 'other'] as const).map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={cn('py-2 rounded-lg text-xs font-semibold transition-colors capitalize',
                    reason === r ? 'text-[#7C6DFF]' : 'text-[#7B7F93] hover:text-[#A4A7B5]')}
                  style={reason === r
                    ? { background: 'rgba(107,92,255,0.15)', border: '1px solid rgba(107,92,255,0.3)' }
                    : { background: '#1B1E2E', border: '1px solid #24273A' }}>
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional context…"
              className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-[#24273A]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]"
            style={{ border: '1px solid #2D3048' }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audit Timeline ─────────────────────────────────────────────────────────

function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock size={24} className="text-[#7B7F93] mx-auto mb-2" />
        <p className="text-sm text-[#7B7F93]">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, i) => {
        const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: '#7B7F93' };
        return (
          <div key={entry.id} className="flex gap-3 pb-4 relative">
            {/* Timeline line */}
            {i < entries.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[#24273A]" />
            )}
            {/* Dot */}
            <div className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
              style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}40` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
                  <p className="text-sm text-[#A4A7B5] leading-snug mt-0.5">{entry.description}</p>
                  {entry.reason && (
                    <span className="text-xs text-[#7B7F93] capitalize">Reason: {entry.reason.replace('_', ' ')}</span>
                  )}
                </div>
                <span className="text-xs text-[#7B7F93] mp-mono flex-shrink-0">{formatTime(entry.timestamp)}</span>
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

export default function DetailInfo() {
  const { state, adjustStock, getVariantStockStatus } = useMerchPad();
  const { products, activeSession } = state;

  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [adjustingVariant, setAdjustingVariant] = useState<{
    variantId: string; productId: string; variantName: string; currentStock: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'stock' | 'audit'>('stock');

  // Load audit log
  useEffect(() => {
    async function load() {
      const db = await getDB();
      const all = await db.getAll('auditLog');
      setAuditEntries(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    }
    load();
  }, [activeSession]);

  // Stats
  const lowStockVariants = products.flatMap(p =>
    p.variants.filter(v => {
      const s = getVariantStockStatus(v);
      return s === 'low' || s === 'empty';
    }).map(v => ({ variant: v, productName: p.name, productId: p.id }))
  );

  const totalRevenue = auditEntries
    .filter(e => e.action === 'tally_confirmed')
    .reduce((sum, e) => {
      const items = e.newValue as Array<{ qty: number; unitPrice: number }> | undefined;
      if (!items) return sum;
      return sum + items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    }, 0);

  const totalUnitsSold = auditEntries
    .filter(e => e.action === 'tally_confirmed')
    .reduce((sum, e) => {
      const items = e.newValue as Array<{ qty: number }> | undefined;
      if (!items) return sum;
      return sum + items.reduce((s, i) => s + i.qty, 0);
    }, 0);

  const handleAdjust = useCallback(async (
    delta: number,
    reason: 'damaged' | 'theft' | 'counting_error' | 'restock' | 'other',
    notes: string
  ) => {
    if (!adjustingVariant) return;
    await adjustStock(
      adjustingVariant.variantId,
      adjustingVariant.productId,
      adjustingVariant.variantName,
      delta,
      reason,
      notes
    );
    setAdjustingVariant(null);
    toast.success('Stock adjusted');
    // Reload audit
    const db = await getDB();
    const all = await db.getAll('auditLog');
    setAuditEntries(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  }, [adjustingVariant, adjustStock]);

  // CSV export
  function exportCSV() {
    const rows = [
      ['Timestamp', 'Action', 'Description', 'Actor', 'Reason'],
      ...auditEntries.map(e => [
        e.timestamp,
        e.action,
        e.description,
        e.actorName,
        e.reason ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merchpad-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }

  return (
    <div className="min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-4">
        <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-widest mb-1">Detail Info</p>
        <h1 className="text-2xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
          Stock & Audit
        </h1>
      </div>

      {/* Summary stats */}
      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Revenue', value: formatCurrency(totalRevenue), color: '#4ADE80' },
          { label: 'Units Sold', value: totalUnitsSold, color: '#7C6DFF' },
          { label: 'Alerts', value: lowStockVariants.length, color: lowStockVariants.length > 0 ? '#F87171' : '#4ADE80' },
        ].map(({ label, value, color }) => (
          <div key={label} className="mp-card p-3 text-center">
            <p className="text-xs text-[#7B7F93] uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-black mp-mono leading-none" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Low stock alerts */}
      {lowStockVariants.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.05)' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(248,113,113,0.2)]">
            <AlertTriangle size={14} className="text-[#F87171]" />
            <span className="text-xs font-bold text-[#F87171] uppercase tracking-wider">Low Stock Alerts</span>
          </div>
          <div className="divide-y divide-[rgba(248,113,113,0.1)]">
            {lowStockVariants.map(({ variant, productName, productId }) => {
              const status = getVariantStockStatus(variant);
              return (
                <div key={variant.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[#E6E7EB]">{variant.name}</p>
                    <p className="text-xs text-[#7B7F93]">{productName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm font-bold mp-mono',
                      status === 'empty' ? 'text-[#F87171]' : 'text-[#FBBF24]')}>
                      {variant.currentStock}
                    </span>
                    <button
                      onClick={() => setAdjustingVariant({ variantId: variant.id, productId, variantName: variant.name, currentStock: variant.currentStock })}
                      className="px-2 py-1 rounded-lg text-xs font-semibold text-[#7C6DFF]"
                      style={{ background: 'rgba(107,92,255,0.1)', border: '1px solid rgba(107,92,255,0.2)' }}>
                      Adjust
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #2D3048', background: '#1B1E2E' }}>
          {(['stock', 'audit'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('flex-1 py-2.5 text-sm font-semibold transition-colors capitalize',
                activeTab === tab ? 'text-white' : 'text-[#7B7F93]')}
              style={activeTab === tab ? { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' } : {}}>
              {tab === 'stock' ? 'Stock' : 'Audit Trail'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* Stock tab */}
        {activeTab === 'stock' && (
          <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="mp-card overflow-hidden">
                <button
                  onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  className="w-full flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Package size={15} className="text-[#7C6DFF]" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#E6E7EB]">{product.name}</p>
                      <p className="text-xs text-[#7B7F93]">{product.variants.length} variants</p>
                    </div>
                  </div>
                  {expandedProduct === product.id
                    ? <ChevronUp size={14} className="text-[#7B7F93]" />
                    : <ChevronDown size={14} className="text-[#7B7F93]" />}
                </button>

                {expandedProduct === product.id && (
                  <div className="border-t border-[#24273A] divide-y divide-[#1B1E2E]">
                    {product.variants.map(v => {
                      const status = getVariantStockStatus(v);
                      const stockColor = status === 'high' ? '#4ADE80' : status === 'medium' ? '#FBBF24' : '#F87171';
                      return (
                        <div key={v.id} className="flex items-center justify-between px-3 py-2.5">
                          <div>
                            <p className="text-sm text-[#E6E7EB]">{v.name}</p>
                            <p className="text-xs text-[#7B7F93] mp-mono">{formatCurrency(v.price)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-bold mp-mono" style={{ color: stockColor }}>{v.currentStock}</p>
                              <p className="text-xs text-[#7B7F93]">of {v.initialStock}</p>
                            </div>
                            <button
                              onClick={() => setAdjustingVariant({ variantId: v.id, productId: product.id, variantName: v.name, currentStock: v.currentStock })}
                              className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB] transition-colors"
                              style={{ border: '1px solid #2D3048' }}>
                              <Sliders size={13} />
                            </button>
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

        {/* Audit tab */}
        {activeTab === 'audit' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#7B7F93]">{auditEntries.length} entries</p>
              <button onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#7C6DFF] transition-colors"
                style={{ border: '1px solid rgba(107,92,255,0.3)', background: 'rgba(107,92,255,0.08)' }}>
                <Download size={12} /> Export CSV
              </button>
            </div>
            <div className="mp-card p-4">
              <AuditTimeline entries={auditEntries} />
            </div>
          </div>
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
