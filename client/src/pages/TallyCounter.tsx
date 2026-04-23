/**
 * Tally Counter — offline-first sale mode
 * Design: "Neon Ledger" — glowing stock-stroke cards, large tally numbers
 *
 * Modes:
 *  1. Standard Mode — running tally, Confirm Sale modal, Undo/Clear
 *  2. Client Mode — single-sale terminal: items → Cash Drawer (money in / change)
 *     • Activated by "Client Mode" button next to the LIVE·Stop group in session bar
 *     • "Stay On" pin: if active, stays enabled between sales; if off, auto-disables after each sale
 *
 * Stock fix: TallyCard receives liveStock from reactive products state, not from session snapshot
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Minus, Plus, RotateCcw, Trash2, CheckCircle2, Zap, ShoppingBag,
  StopCircle, Archive, Info, Banknote, X, Pin, Delete,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { ProductVariant } from '../lib/db';
import { cn } from '../lib/utils';

// ── Stock stroke helper ────────────────────────────────────────────────────
function stockStrokeClass(status: string) {
  switch (status) {
    case 'high':   return 'mp-card-stock-high';
    case 'medium': return 'mp-card-stock-medium';
    case 'low':    return 'mp-card-stock-low';
    case 'empty':  return 'mp-card-stock-empty';
    default:       return '';
  }
}

// ── Tally Card ─────────────────────────────────────────────────────────────
interface TallyCardProps {
  variant: ProductVariant;
  /** Live stock from reactive products state — always post-sale accurate */
  liveStock: number;
  qty: number;
  stockStatus: string;
  onIncrement: () => void;
  onDecrement: () => void;
}

function TallyCard({ variant, liveStock, qty, stockStatus, onIncrement, onDecrement }: TallyCardProps) {
  const [bumping, setBumping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const isEmpty = stockStatus === 'empty';

  useEffect(() => {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showInfo]);

  const tallyTotal = qty * variant.price;

  function handleIncrement() {
    if (isEmpty) return;
    setBumping(true);
    setTimeout(() => setBumping(false), 200);
    onIncrement();
  }

  const stockLabel = { high: 'In Stock', medium: 'Low', low: 'Critical', empty: 'Out' }[stockStatus] ?? '';
  const stockColor = { high: '#4ADE80', medium: '#FBBF24', low: '#F87171', empty: '#F87171' }[stockStatus] ?? '#7B7F93';

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
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0 relative" ref={infoRef}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: stockColor }} />
          <span className="text-[10px] font-semibold" style={{ color: stockColor }}>{stockLabel}</span>
          <button
            onClick={e => { e.stopPropagation(); setShowInfo(v => !v); }}
            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
            style={{ background: showInfo ? 'rgba(107,92,255,0.25)' : 'rgba(107,92,255,0.1)', color: '#7C6DFF' }}>
            <Info size={11} />
          </button>
          {showInfo && (
            <div className="absolute top-6 right-0 z-50 w-44 rounded-xl p-3 shadow-2xl animate-fade-in"
              style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}>
              <p className="text-[10px] font-bold text-[#7C6DFF] uppercase tracking-wider mb-2">Variant Info</p>
              <div className="space-y-1.5">
                {Object.entries(variant.attributes).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7B7F93] capitalize">{key}</span>
                    <span className="text-[10px] font-semibold text-[#A4A7B5]">{val}</span>
                  </div>
                ))}
                <div className="border-t border-[#24273A] pt-1.5 mt-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7B7F93]">In stock</span>
                    {/* liveStock is always the current value from reactive state */}
                    <span className="text-[10px] font-bold" style={{ color: stockColor }}>{liveStock}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7B7F93]">Price</span>
                    <span className="text-[10px] font-semibold text-[#A4A7B5]">€{variant.price.toFixed(2)}</span>
                  </div>
                  {variant.sku && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#7B7F93]">SKU</span>
                      <span className="text-[10px] font-semibold text-[#A4A7B5] mp-mono">{variant.sku}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
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
        <button onClick={onDecrement} disabled={qty === 0}
          className="flex-1 flex items-center justify-center h-9 rounded-lg transition-all active:scale-95 disabled:opacity-30"
          style={{ background: '#0E0F14', border: '1px solid #2D3048' }}>
          <Minus size={14} className="text-[#A4A7B5]" />
        </button>
        <button onClick={handleIncrement} disabled={isEmpty}
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

// ── Standard Confirm Sale Modal ────────────────────────────────────────────
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
      style={{ background: 'rgba(14,15,20,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid rgba(107,92,255,0.3)' }}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(107,92,255,0.12)' }}>
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
            style={{ border: '1px solid #2D3048' }}>Cancel</button>
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

// ── Client Mode Cash Drawer ────────────────────────────────────────────────
// Sticky bottom panel — always visible, not a full-screen overlay
interface CashDrawerProps {
  items: Array<{ name: string; qty: number; total: number }>;
  totalRevenue: number;
  requireMoneyInput: boolean;
  onConfirm: (moneyIn: number) => void;
  onCancel: () => void;
}

const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','00','0','⌫'];

function CashDrawer({ items, totalRevenue, requireMoneyInput, onConfirm, onCancel }: CashDrawerProps) {
  const [moneyIn, setMoneyIn] = useState('');

  // Parse as euro integer (e.g. "2500" = €25.00) — numpad inputs whole euros only
  const euroValue = moneyIn === '' ? null : parseInt(moneyIn, 10);
  const parsed = euroValue !== null ? euroValue : 0;
  const validInput = euroValue !== null && euroValue >= 0;
  const change = validInput ? parsed - totalRevenue : null;
  const sufficient = change !== null && change >= 0;

  // Quick denomination buttons — nearest common values above total
  const quickAmounts = [5, 10, 20, 50, 100].filter(d => d >= totalRevenue).slice(0, 4);

  function handleNumpad(key: string) {
    if (key === '⌫') {
      setMoneyIn(v => v.slice(0, -1));
    } else if (key === '00') {
      setMoneyIn(v => (v === '' ? '' : v + '00'));
    } else {
      setMoneyIn(v => {
        const next = v + key;
        // Max €9999
        if (parseInt(next, 10) > 9999) return v;
        return next;
      });
    }
  }

  const canComplete = sufficient || !requireMoneyInput;

  return (
    // Sticky panel anchored above bottom nav — not a full-screen overlay
    <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-2 animate-slide-up">
      <div className="rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#141624', border: '1px solid rgba(74,222,128,0.3)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#24273A]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(74,222,128,0.12)' }}>
              <Banknote size={14} className="text-[#4ADE80]" />
            </div>
            <span className="text-sm font-black text-[#E6E7EB]">Client Mode</span>
            <span className="text-xs text-[#7B7F93]">· {items.reduce((s, i) => s + i.qty, 0)} items</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-black mp-gradient-text mp-mono">€{totalRevenue.toFixed(2)}</span>
            <button onClick={onCancel} className="text-[#7B7F93] hover:text-[#E6E7EB] p-1 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Info section: items, total due, money received, quick amounts, change, Complete Sale ── */}
        <div className="px-4 pt-3 pb-2 space-y-2.5">
          {/* Items list */}
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {items.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="text-xs text-[#A4A7B5]">
                  <span className="text-[#7C6DFF] font-bold">×{item.qty}</span> {item.name}
                </span>
                <span className="text-xs font-semibold text-[#E6E7EB] mp-mono">€{item.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {/* Total due */}
          <div className="flex items-center justify-between py-2 border-t border-[#24273A]">
            <span className="text-sm font-semibold text-[#A4A7B5]">Total Due</span>
            <span className="text-xl font-black mp-gradient-text mp-mono">€{totalRevenue.toFixed(2)}</span>
          </div>
          {/* Money received display */}
          <div>
            <p className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Money Received</p>
            <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl mb-2"
              style={{
                background: '#0E0F14',
                border: `1px solid ${validInput && sufficient ? 'rgba(74,222,128,0.4)' : validInput && !sufficient ? 'rgba(248,113,113,0.4)' : '#2D3048'}`,
              }}>
              <span className="text-sm font-bold text-[#7B7F93]">€</span>
              <span className="text-xl font-black text-[#E6E7EB] mp-mono flex-1">
                {moneyIn === '' ? <span className="text-[#2D3048]">0</span> : moneyIn}
              </span>
            </div>
            {quickAmounts.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {quickAmounts.map(d => (
                  <button key={d}
                    onClick={() => setMoneyIn(String(d))}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                    style={{
                      background: moneyIn === String(d) ? 'rgba(74,222,128,0.15)' : '#1B1E2E',
                      border: moneyIn === String(d) ? '1px solid rgba(74,222,128,0.4)' : '1px solid #2D3048',
                      color: moneyIn === String(d) ? '#4ADE80' : '#A4A7B5',
                    }}>
                    €{d}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Change display */}
          <div className="flex items-center justify-between py-2 rounded-xl px-3"
            style={{
              background: change === null ? 'rgba(45,48,72,0.4)' : sufficient ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${change === null ? '#2D3048' : sufficient ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
            }}>
            <span className="text-xs font-semibold"
              style={{ color: change === null ? '#7B7F93' : sufficient ? '#4ADE80' : '#F87171' }}>
              {change === null ? 'Change' : sufficient ? 'Change' : 'Short'}
            </span>
            <span className="text-lg font-black mp-mono"
              style={{ color: change === null ? '#2D3048' : sufficient ? '#4ADE80' : '#F87171' }}>
              {change === null ? '—' : sufficient ? `€${change.toFixed(2)}` : `-€${Math.abs(change).toFixed(2)}`}
            </span>
          </div>
          {/* Complete Sale button */}
          <button
            onClick={() => onConfirm(validInput ? parsed : 0)}
            disabled={!canComplete}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={canComplete
              ? { background: 'linear-gradient(135deg, #4ADE80 0%, #059669 100%)', boxShadow: '0 0 16px rgba(74,222,128,0.3)' }
              : { background: '#1B1E2E', opacity: 0.35 }}>
            <CheckCircle2 size={15} /> Complete Sale
          </button>
        </div>
        {/* Numpad — below the info section */}
        <div className="grid grid-cols-3 gap-1.5 px-4 pb-3">
          {NUMPAD_KEYS.map(key => (
            <button
              key={key}
              onClick={() => handleNumpad(key)}
              className={cn(
                'flex items-center justify-center h-11 rounded-xl text-sm font-bold transition-all active:scale-90',
                key === '⌫' ? 'text-[#F87171]' : 'text-[#E6E7EB]'
              )}
              style={{
                background: key === '⌫' ? 'rgba(248,113,113,0.1)' : '#1B1E2E',
                border: `1px solid ${key === '⌫' ? 'rgba(248,113,113,0.2)' : '#2D3048'}`,
              }}>
              {key === '⌫' ? <Delete size={14} /> : key}
            </button>
          ))}
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

  // Client Mode
  const [clientMode, setClientMode] = useState(false);
  const [clientStayOn, setClientStayOn] = useState(false);
  const [showCashDrawer, setShowCashDrawer] = useState(false);

  const allVariants: Array<{ variant: ProductVariant; productName: string }> = products.flatMap(p =>
    p.variants.map(v => ({ variant: v, productName: p.name }))
  );

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category ?? 'Other').filter(Boolean)))];

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

  const handleClientConfirm = useCallback(async (moneyIn: number) => {
    const batch = await confirmSale();
    if (batch) {
      const change = moneyIn - batch.totalPrice;
      setShowCashDrawer(false);
      setJustConfirmed(true);
      toast.success(
        `Sale complete! €${batch.totalPrice.toFixed(2)} · Change: €${change.toFixed(2)}`,
        { duration: 4000 }
      );
      setTimeout(() => setJustConfirmed(false), 2000);
      if (!clientStayOn) setClientMode(false);
    }
  }, [confirmSale, clientStayOn]);

  function handleConfirmButton() {
    if (!hasItems) return;
    if (clientMode) setShowCashDrawer(true);
    else setShowConfirm(true);
  }

  const confirmItems = Object.values(tally.items)
    .filter(i => i.qty > 0)
    .map(i => ({ name: i.variantName, qty: i.qty, total: i.qty * i.unitPrice }));

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
      <div className="px-4 py-2.5 flex items-center justify-between gap-2"
        style={activeSession.sessionType === 'oneoff'
          ? { background: 'rgba(217,119,6,0.08)', borderBottom: '1px solid rgba(217,119,6,0.2)' }
          : { background: 'rgba(107,92,255,0.08)', borderBottom: '1px solid rgba(107,92,255,0.15)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold flex-shrink-0"
            style={{ color: activeSession.sessionType === 'oneoff' ? '#F59E0B' : '#7C6DFF' }}>
            {activeSession.sessionType === 'oneoff' ? 'ONEOFF' : 'SESSION'}
          </span>
          <span className="text-xs text-[#7B7F93] truncate">· {activeSession.repName}</span>
        </div>

        {/* Controls: Client Mode toggle | Stay On pin | LIVE·Stop group */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Client Mode toggle — larger, clearly labelled */}
          <button
            onClick={() => { setClientMode(v => !v); if (showCashDrawer) setShowCashDrawer(false); }}
            title="Toggle Client Mode — single-sale cash helper"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={clientMode
              ? { background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.5)', color: '#4ADE80' }
              : { background: 'rgba(45,48,72,0.6)', border: '1px solid #2D3048', color: '#A4A7B5' }}>
            <Banknote size={13} /> Client Mode
          </button>

          {/* Stay On pin — only visible when Client Mode is active */}
          {clientMode && (
            <button
              onClick={() => setClientStayOn(v => !v)}
              title={clientStayOn ? 'Stay On: persists between sales' : 'Stay On: off (one-shot)'}
              className="flex items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-bold transition-all"
              style={clientStayOn
                ? { background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80' }
                : { background: 'rgba(45,48,72,0.4)', border: '1px solid #2D3048', color: '#7B7F93' }}>
              <Pin size={11} /> {clientStayOn ? 'On' : 'Off'}
            </button>
          )}

          {/* LIVE indicator + Stop Sale — flowing as one unit */}
          <div className="flex items-center rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(248,113,113,0.25)' }}>
            <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <span className="text-[10px] font-bold text-[#4ADE80]">LIVE</span>
            </div>
            <button
              onClick={() => setShowStopConfirm(true)}
              className="flex items-center gap-1 px-2.5 py-2 text-xs font-bold transition-all active:scale-95"
              style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}>
              <StopCircle size={12} /> Stop
            </button>
          </div>
        </div>
      </div>

      {/* Client Mode indicator banner */}
      {clientMode && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl flex items-center gap-2 animate-fade-in"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <Banknote size={12} className="text-[#4ADE80] flex-shrink-0" />
          <span className="text-xs text-[#4ADE80] font-semibold">Client Mode</span>
          <span className="text-xs text-[#7B7F93]">— Cash Sale opens the cash drawer below</span>
          {clientStayOn && (
            <span className="ml-auto flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ADE80', border: '1px solid rgba(74,222,128,0.3)' }}>
              STAY ON
            </span>
          )}
        </div>
      )}

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilterCategory(cat)}
              className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                filterCategory === cat ? 'text-white' : 'text-[#7B7F93] hover:text-[#A4A7B5]'
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
      <div className="px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredVariants.map(({ variant }) => {
            const stockStatus = getVariantStockStatus(variant);
            const qty = tally.items[variant.id]?.qty ?? 0;
            // Always resolve from reactive products state — never from stale session snapshot
            const liveVariant = products.flatMap(p => p.variants).find(v => v.id === variant.id) ?? variant;
            return (
              <TallyCard
                key={variant.id}
                variant={liveVariant}
                qty={qty}
                stockStatus={stockStatus}
                liveStock={liveVariant.currentStock}
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

      {/* Bottom action bar — sits above cash drawer when Client Mode is active */}
      <div className={cn('fixed left-0 right-0 z-30 px-4 pb-2', showCashDrawer ? 'bottom-[calc(16rem+4rem)]' : 'bottom-16')}>
        <div className="rounded-2xl p-3 shadow-2xl"
          style={{ background: 'rgba(20,22,36,0.97)', backdropFilter: 'blur(20px)', border: '1px solid #2D3048' }}>
          {/* Totals row */}
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

          {/* Confirm / Cash Sale button */}
          <button
            onClick={handleConfirmButton}
            disabled={!hasItems}
            className={cn(
              'w-full py-3.5 rounded-xl text-base font-black text-white transition-all flex items-center justify-center gap-2',
              hasItems ? 'mp-btn-primary' : 'opacity-30 cursor-not-allowed'
            )}
            style={hasItems
              ? clientMode
                ? { background: 'linear-gradient(135deg, #4ADE80 0%, #059669 100%)', boxShadow: '0 0 24px rgba(74,222,128,0.35)' }
                : { boxShadow: '0 0 24px rgba(107,92,255,0.35)' }
              : {}}>
            {justConfirmed ? (
              <><CheckCircle2 size={18} /> Sale Confirmed!</>
            ) : clientMode ? (
              <><Banknote size={18} /> Cash Sale</>
            ) : (
              <><CheckCircle2 size={18} /> Confirm Sale</>
            )}
          </button>
        </div>
      </div>

      {/* Spacer — clears bottom nav + action bar + optional cash drawer */}
      <div className={cn(showCashDrawer ? 'h-[34rem]' : 'h-60')} />

      {/* Standard confirm modal */}
      {showConfirm && (
        <ConfirmSaleModal
          items={confirmItems}
          totalUnits={totalUnits}
          totalRevenue={totalRevenue}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Client Mode Cash Drawer — sticky panel, not full-screen */}
      {showCashDrawer && (
        <CashDrawer
          items={confirmItems}
          totalRevenue={totalRevenue}
          requireMoneyInput={settings.requireMoneyInput ?? false}
          onConfirm={handleClientConfirm}
          onCancel={() => setShowCashDrawer(false)}
        />
      )}
    </div>
  );
}
