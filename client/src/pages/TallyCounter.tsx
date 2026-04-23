/**
 * Tally Counter — critical offline-first sale mode
 * Design: "Neon Ledger" — glowing stock-stroke cards, large tally numbers
 * Features: grid of variant cards, +/- counters, stock stroke colors,
 *           CONFIRM SALE, CLEAR ALL, UNDO LAST, real-time totals
 */

import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Minus, Plus, RotateCcw, Trash2, CheckCircle2, Zap, ShoppingBag, StopCircle, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { ProductVariant } from '../lib/db';
import { cn } from '../lib/utils';

// ── Stock stroke class helper ──────────────────────────────────────────────

function stockStrokeClass(status: string) {
  switch (status) {
    case 'high': return 'mp-card-stock-high';
    case 'medium': return 'mp-card-stock-medium';
    case 'low': return 'mp-card-stock-low';
    case 'empty': return 'mp-card-stock-empty';
    default: return '';
  }
}

// ── Tally Card ─────────────────────────────────────────────────────────────

interface TallyCardProps {
  variant: ProductVariant;
  qty: number;
  stockStatus: string;
  onIncrement: () => void;
  onDecrement: () => void;
}

function TallyCard({ variant, qty, stockStatus, onIncrement, onDecrement }: TallyCardProps) {
  const [bumping, setBumping] = useState(false);
  const isEmpty = stockStatus === 'empty';
  const tallyTotal = qty * variant.price;

  function handleIncrement() {
    if (isEmpty) return;
    onIncrement();
    setBumping(true);
    setTimeout(() => setBumping(false), 160);
  }

  const stockLabel = {
    high: 'In Stock',
    medium: 'Low',
    low: 'Critical',
    empty: 'Out',
  }[stockStatus] ?? '';

  const stockColor = {
    high: '#4ADE80',
    medium: '#FBBF24',
    low: '#F87171',
    empty: '#F87171',
  }[stockStatus] ?? '#7B7F93';

  return (
    <div className={cn('mp-card flex flex-col p-3 select-none', stockStrokeClass(stockStatus), isEmpty && 'opacity-50')}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-[#E6E7EB] uppercase tracking-wide leading-tight truncate">
            {variant.name.split(' ').slice(0, -1).join(' ') || variant.name}
          </p>
          <p className="text-xs text-[#A4A7B5] truncate">
            {Object.values(variant.attributes).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: stockColor }} />
          <span className="text-[10px] font-semibold" style={{ color: stockColor }}>{stockLabel}</span>
        </div>
      </div>

      {/* Tally number */}
      <div className="flex-1 flex items-center justify-center py-2">
        <span
          className={cn('mp-tally-number', bumping && 'animate-counter-bump')}
          style={{ color: qty > 0 ? '#E6E7EB' : '#2D3048' }}>
          {qty}
        </span>
      </div>

      {/* +/- controls */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={onDecrement}
          disabled={qty === 0}
          className="flex-1 flex items-center justify-center h-9 rounded-lg transition-all active:scale-95 disabled:opacity-30"
          style={{ background: '#0E0F14', border: '1px solid #2D3048' }}>
          <Minus size={14} className="text-[#A4A7B5]" />
        </button>
        <button
          onClick={handleIncrement}
          disabled={isEmpty}
          className="flex-[2] flex items-center justify-center h-9 rounded-lg font-bold text-white transition-all active:scale-95 disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg, #6B5CFF 0%, #C026D3 100%)' }}>
          <Plus size={16} />
        </button>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#7B7F93] mp-mono">€{variant.price.toFixed(2)}</span>
        <span className={cn('text-xs font-bold mp-mono', qty > 0 ? 'text-[#E6E7EB]' : 'text-[#2D3048]')}>
          {qty > 0 ? `€${tallyTotal.toFixed(2)}` : '—'}
        </span>
      </div>
    </div>
  );
}

// ── Confirm Sale Modal ─────────────────────────────────────────────────────

interface ConfirmSaleModalProps {
  items: Array<{ name: string; qty: number; total: number }>;
  totalUnits: number;
  totalRevenue: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmSaleModal({ items, totalUnits, totalRevenue, onConfirm, onCancel }: ConfirmSaleModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.9)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid #2D3048' }}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(107,92,255,0.15)' }}>
              <CheckCircle2 size={20} className="text-[#7C6DFF]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E6E7EB]">Confirm Sale</h2>
              <p className="text-xs text-[#7B7F93]">{totalUnits} items · €{totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
            {items.map(item => (
              <div key={item.name} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                style={{ background: 'rgba(14,15,20,0.5)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#7C6DFF] mp-mono w-5 text-center">×{item.qty}</span>
                  <span className="text-sm text-[#A4A7B5]">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-[#E6E7EB] mp-mono">€{item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between py-3 border-t border-[#24273A] mb-4">
            <span className="text-sm font-semibold text-[#A4A7B5]">Total</span>
            <span className="text-xl font-black text-[#E6E7EB] mp-mono">€{totalRevenue.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#A4A7B5]"
            style={{ border: '1px solid #2D3048' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-[2] py-3 rounded-xl text-sm font-black text-white mp-btn-primary flex items-center justify-center gap-2"
            style={{ boxShadow: '0 0 20px rgba(107,92,255,0.3)' }}>
            <CheckCircle2 size={16} /> Confirm Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function TallyCounter() {
  const [, navigate] = useLocation();
  const { state, dispatch, confirmSale, getVariantStockStatus, getTallyTotal } = useMerchPad();
  const { products, activeSession, tally, settings } = state;

  const [showConfirm, setShowConfirm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Flatten all variants
  const allVariants: Array<{ variant: ProductVariant; productName: string }> = products.flatMap(p =>
    p.variants.map(v => ({ variant: v, productName: p.name }))
  );

  // Categories
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category ?? 'Other').filter(Boolean)))];

  // Filtered variants
  const filteredVariants = filterCategory === 'all'
    ? allVariants
    : allVariants.filter(({ variant }) => {
        const product = products.find(p => p.id === variant.productId);
        return (product?.category ?? 'Other') === filterCategory;
      });

  const { units: totalUnits, revenue: totalRevenue } = getTallyTotal();
  const hasItems = totalUnits > 0;

  const handleConfirm = useCallback(async () => {
    const batch = await confirmSale();
    if (batch) {
      setShowConfirm(false);
      setJustConfirmed(true);
      toast.success(`Sale confirmed! ${batch.totalItems} items · €${batch.totalPrice.toFixed(2)}`);
      setTimeout(() => setJustConfirmed(false), 2000);
    }
  }, [confirmSale]);

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(107,92,255,0.1)', border: '1px solid rgba(107,92,255,0.2)' }}>
          <Zap size={28} className="text-[#6B5CFF]" />
        </div>
        <h2 className="text-xl font-black text-[#E6E7EB] mb-2">No Active Session</h2>
        <p className="text-sm text-[#7B7F93] mb-6 max-w-xs">
          Go to Merch Office, select a show, and start a sale session to activate the Tally Counter.
        </p>
        <button onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white mp-btn-primary flex items-center gap-2">
          <ShoppingBag size={15} /> Go to Merch Office
        </button>
      </div>
    );
  }

  const confirmItems = Object.values(tally.items).map(i => ({
    name: i.variantName,
    qty: i.qty,
    total: i.qty * i.unitPrice,
  }));

  return (
    <div className="min-h-full animate-fade-in">
      {/* Stop Sale confirm overlay */}
      {showStopConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(14,15,20,0.92)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
            style={{ background: '#141624', border: '1px solid rgba(248,113,113,0.3)' }}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(248,113,113,0.12)' }}>
                  <StopCircle size={20} className="text-[#F87171]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#E6E7EB]">Stop Sale?</h2>
                  <p className="text-xs text-[#7B7F93]">You'll review the session before archiving</p>
                </div>
              </div>
              <p className="text-sm text-[#A4A7B5] mb-4">
                This will take you to the Archive screen where you can review all sales and confirm the session end.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowStopConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-[#A4A7B5]"
                style={{ border: '1px solid #2D3048' }}>Keep Selling</button>
              <button onClick={() => { setShowStopConfirm(false); navigate('/end-sale'); }}
                className="flex-[2] py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #F87171 0%, #C026D3 100%)' }}>
                <Archive size={15} /> Review & Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session bar */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(107,92,255,0.08)', borderBottom: '1px solid rgba(107,92,255,0.15)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
          <span className="text-xs font-semibold text-[#7C6DFF]">SALE ACTIVE</span>
          <span className="text-xs text-[#7B7F93]">· {activeSession.repName}</span>
          {activeSession.standName && (
            <span className="text-xs text-[#7B7F93]">· {activeSession.standName}</span>
          )}
        </div>
        <button
          onClick={() => setShowStopConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
          style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171' }}>
          <StopCircle size={12} /> Stop Sale
        </button>
      </div>

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                filterCategory === cat
                  ? 'text-white'
                  : 'text-[#7B7F93] hover:text-[#A4A7B5]'
              )}
              style={filterCategory === cat
                ? { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }
                : { background: '#1B1E2E', border: '1px solid #2D3048' }}>
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Last action feedback */}
      {tally.lastAction && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg flex items-center gap-2 animate-fade-in"
          style={{ background: 'rgba(107,92,255,0.08)', border: '1px solid rgba(107,92,255,0.15)' }}>
          <span className={cn('text-xs font-bold mp-mono',
            tally.lastAction.action === '+1' ? 'text-[#4ADE80]' : 'text-[#F87171]')}>
            {tally.lastAction.action}
          </span>
          <span className="text-xs text-[#A4A7B5] truncate">{tally.lastAction.variantName}</span>
          <span className="text-xs text-[#7B7F93] ml-auto flex-shrink-0">
            {new Date(tally.lastAction.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )}

      {/* Tally grid */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredVariants.map(({ variant }) => {
            const stockStatus = getVariantStockStatus(variant);
            const qty = tally.items[variant.id]?.qty ?? 0;
            return (
              <TallyCard
                key={variant.id}
                variant={variant}
                qty={qty}
                stockStatus={stockStatus}
                onIncrement={() => dispatch({ type: 'TALLY_INCREMENT', payload: { variantId: variant.id, variantName: variant.name, unitPrice: variant.price } })}
                onDecrement={() => dispatch({ type: 'TALLY_DECREMENT', payload: { variantId: variant.id, variantName: variant.name } })}
              />
            );
          })}
        </div>

        {filteredVariants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[#7B7F93]">No items in this category</p>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 px-4 pb-2">
        <div className="rounded-2xl p-3 shadow-2xl"
          style={{ background: 'rgba(20,22,36,0.97)', backdropFilter: 'blur(20px)', border: '1px solid #2D3048' }}>

          {/* Totals */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-[#7B7F93]">Units</p>
                <p className="text-lg font-black text-[#E6E7EB] mp-mono leading-none">{totalUnits}</p>
              </div>
              <div className="w-px h-8 bg-[#24273A]" />
              <div>
                <p className="text-xs text-[#7B7F93]">Total</p>
                <p className="text-lg font-black mp-gradient-text mp-mono leading-none">€{totalRevenue.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {settings.undoEnabled && tally.lastAction && (
                <button
                  onClick={() => dispatch({ type: 'TALLY_UNDO_LAST' })}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#A4A7B5] hover:text-[#E6E7EB] transition-colors"
                  style={{ border: '1px solid #2D3048' }}>
                  <RotateCcw size={13} /> Undo
                </button>
              )}
              <button
                onClick={() => dispatch({ type: 'TALLY_CLEAR' })}
                disabled={!hasItems}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#F87171] disabled:opacity-30 transition-colors"
                style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
                <Trash2 size={13} /> Clear
              </button>
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={() => { if (hasItems) setShowConfirm(true); }}
            disabled={!hasItems}
            className={cn(
              'w-full py-3.5 rounded-xl text-base font-black text-white transition-all flex items-center justify-center gap-2',
              hasItems ? 'mp-btn-primary' : 'opacity-30 cursor-not-allowed'
            )}
            style={hasItems ? { boxShadow: '0 0 24px rgba(107,92,255,0.35)' } : {}}>
            {justConfirmed ? (
              <><CheckCircle2 size={18} /> Sale Confirmed!</>
            ) : (
              <><CheckCircle2 size={18} /> Confirm Sale</>
            )}
          </button>
        </div>
      </div>

      {/* Spacer for action bar */}
      <div className="h-36" />

      {/* Confirm modal */}
      {showConfirm && (
        <ConfirmSaleModal
          items={confirmItems}
          totalUnits={totalUnits}
          totalRevenue={totalRevenue}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
