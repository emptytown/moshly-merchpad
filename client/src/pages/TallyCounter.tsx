/**
 * Tally Counter — offline-first sale mode  v0.14.0
 * Design: "Neon Ledger" — glowing stock-stroke cards, large tally numbers
 *
 * Modes:
 *  1. TALLY mode (default) — + tap instantly records a single-item sale.
 *     Big number on card = cumulative session-sold count (persists across sales).
 *  2. REGISTER mode — build basket, Confirm Sale opens augmented modal with
 *     items list (with +/- tweaks), total, money received, change, Complete Sale,
 *     collapsible iOS numpad.  Basket preview available via expand button on bar.
 *
 * Key state:
 *  - sessionSold: Record<variantId, number>  — cumulative sold this session
 *  - tally.items: current basket (resets after each confirmed sale in Register mode)
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Minus, Plus, RotateCcw, Trash2, CheckCircle2, Zap, ShoppingBag,
  StopCircle, Archive, Info, ChevronDown, ChevronUp, Delete, Eye, Package, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { setSetting, getSetting, ProductVariant, TeamMember } from '../lib/db';
import { cn } from '../lib/utils';

// ── Euro denominations for quick-amount buttons ────────────────────────────
const EURO_DENOMS = [1, 2, 5, 10, 20, 50, 100, 200];

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
  liveStock: number;
  /** Cumulative units sold this session for this variant */
  sessionSoldQty: number;
  /** Current basket qty (Register mode) */
  basketQty: number;
  stockStatus: string;
  tallyMode: boolean;
  /** True when remaining road stock (liveStock - sessionSoldQty) <= 0 */
  effectivelyEmpty: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onInstantSell: () => void;
  allowMidSaleRestock: boolean;
  warehouseStock: number;
  onRestock: (qty: number) => void;
  symbol: string;
}
function TallyCard({
  variant, liveStock, sessionSoldQty, basketQty, stockStatus,
  tallyMode, effectivelyEmpty, onIncrement, onDecrement, onInstantSell,
  allowMidSaleRestock, warehouseStock, onRestock, symbol,
}: TallyCardProps) {
  const [bumping, setBumping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showRestockPicker, setShowRestockPicker] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  // In Tally mode: effectively empty when currentStock (post-sale) reaches 0
  const isEmpty = tallyMode ? (liveStock <= 0) : stockStatus === 'empty';

  useEffect(() => {
    if (!showInfo) return;
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setShowInfo(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showInfo]);

  // The big displayed number: cumulative sold in Tally mode, basket qty in Register mode
  const displayQty = tallyMode ? sessionSoldQty : basketQty;

  function handleIncrement(e: React.MouseEvent) {
    e.stopPropagation();
    // Allow click even if isEmpty=true so handleInstantSell can show the toast/feedback
    if (tallyMode) {
      onInstantSell();
      if (!isEmpty) {
        setBumping(true);
        setTimeout(() => setBumping(false), 200);
      }
      return;
    }

    if (isEmpty) return;
    setBumping(true);
    setTimeout(() => setBumping(false), 200);
    onIncrement();
  }

  // stockLabel removed — 'In Stock' indicator removed per design decision
  const stockLabel = stockStatus !== 'high' ? ({ medium: 'Low', low: 'Critical', empty: 'Out' }[stockStatus] ?? '') : '';
  const stockColor = { high: '#4ADE80', medium: '#FBBF24', low: '#F87171', empty: '#F87171' }[stockStatus] ?? '#7B7F93';

  return (
    <div className={cn(
      'mp-card flex flex-col p-3 select-none transition-all',
      stockStrokeClass(stockStatus),
      isEmpty && 'opacity-50',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground uppercase tracking-wide leading-tight truncate">
            {variant.name.split(' ').slice(0, -1).join(' ') || variant.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {Object.values(variant.attributes).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0 relative" ref={infoRef}>
          {stockStatus !== 'high' && (
            <>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: stockColor }} />
              <span className="text-[10px] font-semibold" style={{ color: stockColor }}>{stockLabel}</span>
            </>
          )}
          <button
            onClick={e => { e.stopPropagation(); setShowInfo(v => !v); }}
            className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
            style={{ background: showInfo ? 'rgba(107,92,255,0.25)' : 'rgba(107,92,255,0.1)', color: '#7C6DFF' }}>
            <Info size={11} />
          </button>
          {showInfo && (
            <div className="mp-variant-info-popup absolute top-6 right-0 z-50 w-44 rounded-xl p-3 shadow-2xl animate-fade-in"
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
                    <span className="text-[10px] font-bold" style={{ color: stockColor }}>{liveStock}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7B7F93]">Price</span>
                    <span className="text-[10px] font-semibold text-[#A4A7B5]">{symbol}{variant.price.toFixed(2)}</span>
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

      {/* Big number — session cumulative in Tally, basket qty in Register */}
      <div className="flex-1 flex items-center justify-center py-2">
        <span
          className={cn('mp-tally-number', bumping && 'animate-counter-bump')}
          style={{ color: displayQty > 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
          {displayQty}
        </span>
      </div>

      {/* +/- controls */}
      <div className="flex items-center gap-1.5 mb-2">
        <button onClick={e => { e.stopPropagation(); onDecrement(); }} disabled={basketQty === 0 || tallyMode}
          className="flex-1 flex items-center justify-center h-9 rounded-lg transition-all active:scale-95 disabled:opacity-30"
          style={{ background: '#0E0F14', border: '1px solid #2D3048' }}>
          <Minus size={14} className="text-[#A4A7B5]" />
        </button>
        <button onClick={handleIncrement}
          className="flex-[2] flex items-center justify-center h-9 rounded-lg font-bold text-white transition-all active:scale-95 disabled:opacity-30"
          style={{ background: tallyMode
            ? 'linear-gradient(135deg, #4ADE80 0%, #059669 100%)'
            : 'linear-gradient(135deg, #6B5CFF 0%, #C026D3 100%)',
            opacity: isEmpty ? 0.4 : 1 }}>
          <Plus size={16} />
        </button>
      </div>

      {/* Mid-sale restock button (Tally mode only, when enabled) */}
      {tallyMode && allowMidSaleRestock && warehouseStock > 0 && (
        <div className="mb-1">
          {!showRestockPicker ? (
            <button
              onClick={() => setShowRestockPicker(true)}
              className="w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-semibold transition-all active:scale-95"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#FBBF24' }}>
              <Package size={10} /> Restock (WH: {warehouseStock})
            </button>
          ) : (
            <div className="flex items-center gap-1 justify-between">
              {[1, 2, 5, 10].filter(q => q <= warehouseStock).map(q => (
                <button key={q}
                  onClick={() => { onRestock(q); setShowRestockPicker(false); }}
                  className="flex-1 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-90"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24' }}>
                  +{q}
                </button>
              ))}
              <button
                onClick={() => setShowRestockPicker(false)}
                className="flex-1 py-1 rounded-lg text-[10px] font-bold text-[#7B7F93] transition-all active:scale-90"
                style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}>
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      {/* Price / running total */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground mp-mono">{symbol}{variant.price.toFixed(2)}</span>
        {!tallyMode && basketQty > 0 ? (
          <span className="text-xs font-bold mp-mono text-foreground">
            {symbol}{(basketQty * variant.price).toFixed(2)}
          </span>
        ) : tallyMode ? (
          (() => {
            // liveStock is already post-sale (confirmSale decrements currentStock in DB+state)
            if (liveStock <= 0) return (
              <span className="text-xs font-bold mp-mono text-[#F87171]">Out</span>
            );
            if (liveStock <= 3) return (
              <span className="text-xs font-bold mp-mono text-[#FBBF24]">{liveStock} Left</span>
            );
            return (
              <span className="text-xs font-bold mp-mono text-[#4ADE80]">{liveStock} Left</span>
            );
          })()
        ) : (
          <span className="text-xs font-bold mp-mono text-[#2D3048]">—</span>
        )}
      </div>
    </div>
  );
}

// ── Basket Preview Sheet (Register mode — expand button) ───────────────────
interface BasketPreviewProps {
  items: Array<{ variantId: string; name: string; qty: number; unitPrice: number }>;
  totalRevenue: number;
  symbol: string;
  onClose: () => void;
  onAdjust: (variantId: string, variantName: string, unitPrice: number, delta: number) => void;
}
function BasketPreview({ items, totalRevenue, symbol, onClose, onAdjust }: BasketPreviewProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center"
      style={{ background: 'rgba(14,15,20,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl animate-slide-up pb-safe"
        style={{ background: '#141624', border: '1px solid rgba(107,92,255,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h3 className="text-sm font-bold text-[#E6E7EB]">Current Basket</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#7B7F93]"
            style={{ background: 'rgba(45,48,72,0.5)' }}>
            <ChevronDown size={14} />
          </button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-[#7B7F93] text-center py-6">Basket is empty</p>
        ) : (
          <div className="px-5 space-y-1 max-h-64 overflow-y-auto pb-4">
            {items.map(item => (
              <div key={item.variantId} className="flex items-center justify-between py-2 px-2 rounded-lg"
                style={{ background: 'rgba(14,15,20,0.5)' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-[#7C6DFF] mp-mono w-5 text-center">×{item.qty}</span>
                  <span className="text-sm text-[#A4A7B5] truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-sm font-bold text-[#E6E7EB] mp-mono mr-2">
                    {symbol}{(item.qty * item.unitPrice).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onAdjust(item.variantId, item.name, item.unitPrice, -1)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <Minus size={10} className="text-[#F87171]" />
                  </button>
                  <button
                    onClick={() => onAdjust(item.variantId, item.name, item.unitPrice, 1)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'rgba(107,92,255,0.12)', border: '1px solid rgba(107,92,255,0.2)' }}>
                    <Plus size={10} className="text-[#7C6DFF]" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-[#24273A]">
              <span className="text-sm font-semibold text-[#A4A7B5]">Total</span>
              <span className="text-base font-black mp-gradient-text mp-mono">{symbol}{totalRevenue.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shortfall Modal ────────────────────────────────────────────────────────

interface ShortfallModalProps {
  shortfall: number;
  totalRevenue: number;
  symbol: string;
  requireDiscountReason: boolean;
  allowSellerDebt: boolean;
  requireDebtReason: boolean;
  activeMembers: TeamMember[];
  onDiscount: (reason?: string) => void;
  onSellerDebt: (memberId: string, memberName: string, reason?: string) => void;
  onGoBack: () => void;
  onCancel: () => void;
}

type ShortfallStep = 'main' | 'discount-reason' | 'debt-pick-member' | 'debt-reason';

function ShortfallModal({
  shortfall, totalRevenue, symbol, requireDiscountReason, allowSellerDebt, requireDebtReason,
  activeMembers, onDiscount, onSellerDebt, onGoBack, onCancel,
}: ShortfallModalProps) {
  const [step, setStep] = useState<ShortfallStep>('main');
  const [reason, setReason] = useState('');
  const [pickedMember, setPickedMember] = useState<TeamMember | null>(null);

  function handleDiscountClick() {
    if (requireDiscountReason) { setStep('discount-reason'); }
    else { onDiscount(); }
  }

  function handleDebtClick() {
    if (activeMembers.length === 1) {
      setPickedMember(activeMembers[0]);
      if (requireDebtReason) { setStep('debt-reason'); }
      else { onSellerDebt(activeMembers[0].id, activeMembers[0].name); }
    } else {
      setStep('debt-pick-member');
    }
  }

  function handleMemberPick(m: TeamMember) {
    setPickedMember(m);
    if (requireDebtReason) { setStep('debt-reason'); }
    else { onSellerDebt(m.id, m.name); }
  }

  function handleConfirmDiscount() { onDiscount(reason.trim() || undefined); }
  function handleConfirmDebt() {
    if (!pickedMember) return;
    onSellerDebt(pickedMember.id, pickedMember.name, reason.trim() || undefined);
  }

  function goBack() {
    if (step === 'discount-reason' || step === 'debt-pick-member') setStep('main');
    else if (step === 'debt-reason') setStep(activeMembers.length === 1 ? 'main' : 'debt-pick-member');
    else onGoBack();
  }

  const paidStr = shortfall < totalRevenue ? `${symbol}${(totalRevenue - shortfall).toFixed(2)} paid` : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(14,15,20,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="mp-register-modal w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up overflow-hidden"
        style={{ background: '#141624', border: '1px solid rgba(248,113,113,0.3)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <h2 className="text-base font-black text-[#F87171]">Cash is not enough!</h2>
            <p className="text-xs text-[#7B7F93] mt-0.5">
              <span className="font-bold text-[#F87171]">{symbol}{shortfall.toFixed(2)} short</span>
              {paidStr && <span> · {paidStr}</span>}
              {' · '}Total {symbol}{totalRevenue.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-2">
          {/* ── MAIN STEP ── */}
          {step === 'main' && (
            <>
              <button onClick={handleDiscountClick}
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-between px-4 transition-all active:scale-[0.98]"
                style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#FBBF24' }}>
                <span>Confirm as Discount</span>
                <span className="text-xs opacity-60">−{symbol}{shortfall.toFixed(2)}</span>
              </button>

              {allowSellerDebt && activeMembers.length > 0 && (
                <button onClick={handleDebtClick}
                  className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-between px-4 transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171' }}>
                  <span>Confirm as Seller Debt</span>
                  <span className="text-xs opacity-60">−{symbol}{shortfall.toFixed(2)}</span>
                </button>
              )}

              <button onClick={onGoBack}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#A4A7B5] transition-all active:scale-[0.98]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Go Back to Cart
              </button>

              <button onClick={onCancel}
                className="w-full py-2 text-sm font-semibold text-[#F87171] opacity-70 hover:opacity-100 transition-opacity">
                Cancel Sale
              </button>
            </>
          )}

          {/* ── DISCOUNT REASON STEP ── */}
          {step === 'discount-reason' && (
            <>
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1">State the reason for this discount</p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Friend of band, promotion..."
                className="w-full rounded-xl px-3 py-2.5 text-sm text-[#E6E7EB] resize-none outline-none"
                rows={3}
                style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}
                autoFocus
              />
              <button onClick={handleConfirmDiscount}
                className="w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)' }}>
                Confirm Discount
              </button>
              <div className="flex gap-2">
                <button onClick={goBack}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#A4A7B5] transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Go Back
                </button>
                <button onClick={onCancel}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#F87171] transition-all"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  Cancel Sale
                </button>
              </div>
            </>
          )}

          {/* ── DEBT MEMBER PICKER ── */}
          {step === 'debt-pick-member' && (
            <>
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1">Which seller is responsible?</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {activeMembers.map(m => (
                  <button key={m.id} onClick={() => handleMemberPick(m)}
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-left transition-all active:scale-[0.98]"
                    style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#E6E7EB' }}>
                    {m.name}
                    {m.totalDebt && m.totalDebt > 0 ? (
                      <span className="ml-2 text-xs text-[#F87171]">−{symbol}{m.totalDebt.toFixed(0)} existing debt</span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={goBack}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#A4A7B5] transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Go Back
                </button>
                <button onClick={onCancel}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#F87171] transition-all"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  Cancel Sale
                </button>
              </div>
            </>
          )}

          {/* ── DEBT REASON STEP ── */}
          {step === 'debt-reason' && pickedMember && (
            <>
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-0.5">
                Reason — debt assigned to <span className="text-[#F87171]">{pickedMember.name}</span>
              </p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Customer had no cash, promised to return..."
                className="w-full rounded-xl px-3 py-2.5 text-sm text-[#E6E7EB] resize-none outline-none"
                rows={3}
                style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}
                autoFocus
              />
              <button onClick={handleConfirmDebt}
                className="w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #F87171 0%, #EF4444 100%)' }}>
                Confirm Seller Debt
              </button>
              <div className="flex gap-2">
                <button onClick={goBack}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#A4A7B5] transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Go Back
                </button>
                <button onClick={onCancel}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#F87171] transition-all"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  Cancel Sale
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Register Modal (augmented Confirm Sale + cash drawer + iOS numpad) ─────
const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','00','0','\u232b'] as const;

interface RegisterModalProps {
  items: Array<{ variantId: string; name: string; qty: number; unitPrice: number }>;
  totalRevenue: number;
  symbol: string;
  requireMoneyInput: boolean;
  onConfirm: (moneyIn: number) => void;
  onCancel: () => void;
  onAdjust: (variantId: string, variantName: string, unitPrice: number, delta: number) => void;
}
function RegisterModal({ items, totalRevenue, symbol, requireMoneyInput, onConfirm, onCancel, onAdjust }: RegisterModalProps) {
  const [moneyIn, setMoneyIn] = useState(0);
  const [numpadOpen, setNumpadOpen] = useState(true);
  const [numpadRaw, setNumpadRaw] = useState('');

  // moneyIn is the running sum from denomination taps + numpad
  const totalUnits = items.reduce((s, i) => s + i.qty, 0);
  const validInput = moneyIn > 0;
  const sufficient = validInput && moneyIn >= totalRevenue;
  const change = validInput ? moneyIn - totalRevenue : null;
  const canComplete = sufficient || !requireMoneyInput;

  function handleDenom(d: number) {
    setMoneyIn(v => Math.min(v + d, 9999));
    setNumpadRaw('');
  }

  function handleNumpad(key: string) {
    if (key === '\u232b') {
      const next = numpadRaw.slice(0, -1);
      setNumpadRaw(next);
      setMoneyIn(parseFloat(next) || 0);
    } else if (key === '00') {
      const next = numpadRaw === '' ? '' : numpadRaw + '00';
      setNumpadRaw(next);
      setMoneyIn(parseFloat(next) || 0);
    } else {
      const next = numpadRaw + key;
      if (parseFloat(next) <= 9999) {
        setNumpadRaw(next);
        setMoneyIn(parseFloat(next) || 0);
      }
    }
  }

  function handleClearMoney() {
    setMoneyIn(0);
    setNumpadRaw('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="mp-register-modal w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up overflow-hidden"
        style={{ background: '#141624', border: '1px solid rgba(107,92,255,0.3)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(107,92,255,0.12)' }}>
              <CheckCircle2 size={14} className="text-[#7C6DFF]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E6E7EB]">Confirm Sale</h2>
              <p className="text-xs text-[#7B7F93]">{totalUnits} items · {symbol}{totalRevenue.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
            style={{ background: 'rgba(107,92,255,0.15)', border: '1px solid rgba(107,92,255,0.35)', color: '#7C6DFF' }}>
            <X size={13} /> Back
          </button>
        </div>

        {/* Items list with +/- tweaks */}
        <div className="px-4 space-y-0.5 max-h-28 overflow-y-auto mb-1">
          {items.map(item => (
            <div key={item.variantId} className="mp-basket-row flex items-center justify-between py-1.5 px-2 rounded-lg"
              style={{ background: 'rgba(14,15,20,0.5)' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-bold text-[#7C6DFF] mp-mono w-5 text-center">×{item.qty}</span>
                <span className="text-sm text-[#A4A7B5] truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                <span className="text-sm font-bold text-[#E6E7EB] mp-mono mr-1">
                  {symbol}{(item.qty * item.unitPrice).toFixed(2)}
                </span>
                <button
                  onClick={() => onAdjust(item.variantId, item.name, item.unitPrice, -1)}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <Minus size={10} className="text-[#F87171]" />
                </button>
                <button
                  onClick={() => onAdjust(item.variantId, item.name, item.unitPrice, 1)}
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-all active:scale-90"
                  style={{ background: 'rgba(107,92,255,0.12)', border: '1px solid rgba(107,92,255,0.2)' }}>
                  <Plus size={10} className="text-[#7C6DFF]" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Total row */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-b border-[#24273A]">
          <span className="text-sm font-semibold text-[#A4A7B5]">Total</span>
          <span className="text-xl font-black mp-gradient-text mp-mono">{symbol}{totalRevenue.toFixed(2)}</span>
        </div>

        {/* Money received */}
        <div className="px-4 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">Money Received</p>
            {moneyIn > 0 && (
              <button onClick={handleClearMoney}
                className="text-[10px] font-semibold text-[#F87171] hover:text-[#FCA5A5] transition-colors">
                Clear
              </button>
            )}
          </div>
          <div className="mp-money-input flex items-center gap-1 px-3 py-2 rounded-2xl mb-1.5"
            style={{
              background: '#0E0F14',
              border: `1px solid ${validInput && sufficient ? 'rgba(74,222,128,0.4)' : validInput && !sufficient ? 'rgba(248,113,113,0.4)' : '#2D3048'}`,
            }}>
            <span className="text-sm font-bold text-[#7B7F93]">{symbol}</span>
            <span className="text-xl font-black text-[#E6E7EB] mp-mono flex-1">
              {moneyIn === 0 ? <span className="text-[#2D3048]">0</span> : moneyIn.toFixed(2)}
            </span>
          </div>

          {/* Euro denomination quick-add buttons */}
          <div className="flex gap-1 flex-wrap mb-1.5">
            {EURO_DENOMS.map(d => (
              <button key={d}
                onClick={() => handleDenom(d)}
                className="mp-denom-btn px-2.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                style={{
                  background: '#1B1E2E',
                  border: '1px solid #2D3048',
                  color: '#A4A7B5',
                }}>
                {symbol}{d}
              </button>
            ))}
          </div>
        </div>

        {/* Change display */}
        <div className="mx-4 mb-2 flex items-center justify-between py-2 rounded-2xl px-4"
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
            {change === null ? '—' : sufficient ? `${symbol}${change.toFixed(2)}` : `-${symbol}${Math.abs(change).toFixed(2)}`}
          </span>
        </div>

        {/* Complete Sale button */}
        <div className="px-4 mb-2">
          <button
            onClick={() => onConfirm(moneyIn)}
            disabled={!canComplete}
            className="w-full py-3 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={canComplete
              ? { background: 'linear-gradient(135deg, #4ADE80 0%, #059669 100%)', boxShadow: '0 0 20px rgba(74,222,128,0.3)' }
              : { background: '#1B1E2E', opacity: 0.35 }}>
            <CheckCircle2 size={15} /> Complete Sale
          </button>
        </div>

        {/* Numpad toggle */}
        <button
          onClick={() => setNumpadOpen(v => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#7B7F93] hover:text-[#A4A7B5] transition-colors border-t border-[#24273A]">
          {numpadOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          {numpadOpen ? 'Hide Numpad' : 'Show Numpad'}
        </button>

        {/* iOS-style numpad */}
        {numpadOpen && (
          <div className="grid grid-cols-3 gap-1.5 px-4 pb-3 pt-2">
            {NUMPAD_KEYS.map(key => (
              <button
                key={key}
                onClick={() => handleNumpad(key)}
                className={cn(
                  'mp-numpad-key flex items-center justify-center h-11 rounded-2xl text-base font-bold transition-all active:scale-90',
                  key === '\u232b' ? 'text-[#F87171] mp-numpad-key--delete' : 'text-[#E6E7EB]'
                )}
                style={{
                  background: key === '\u232b' ? 'rgba(248,113,113,0.12)' : '#1B1E2E',
                  border: `1px solid ${key === '\u232b' ? 'rgba(248,113,113,0.25)' : '#2D3048'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                {key === '\u232b' ? <Delete size={18} /> : key}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────
export default function TallyCounter() {
  const [, navigate] = useLocation();
  const { state, dispatch, confirmSale, recordSellerDebt, getVariantStockStatus, getTallyTotal, transferStock } = useMerchPad();
  const { products, activeSession, tally, settings, teamMembers } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  const allowMidSaleRestock = settings.allowMidSaleRestock ?? false;
  const stickyBarTally = settings.stickyBarTally ?? true;
  const stickyBarRegister = settings.stickyBarRegister ?? true;
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showShortfallModal, setShowShortfallModal] = useState(false);
  const [pendingMoneyIn, setPendingMoneyIn] = useState(0);
  const [showBasketPreview, setShowBasketPreview] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  // Restore persisted category filter on mount
  useEffect(() => {
    getSetting<string>('tallyFilterCategory', 'all').then(saved => {
      if (saved) setFilterCategory(saved);
    });
  }, []);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // TALLY = instant-confirm mode (default), REGISTER = cash drawer modal mode
  const [mode, setMode] = useState<'tally' | 'register'>('tally');
  const tallyMode = mode === 'tally';
  // Restore persisted mode on mount
  useEffect(() => {
    getSetting<string>('tallyMode', 'tally').then(saved => {
      if (saved === 'register') setMode('register');
    });
  }, []);

  // Cumulative session-sold counts — persists across individual sales, resets only at session close
  const [sessionSold, setSessionSold] = useState<Record<string, number>>({});

  // Reset sessionSold when the active session changes (new session started)
  const prevSessionId = useRef<string | null>(null);
  useEffect(() => {
    const currentId = activeSession?.id ?? null;
    if (currentId !== prevSessionId.current) {
      prevSessionId.current = currentId;
      setSessionSold({});
    }
  }, [activeSession?.id]);

  const allVariants: Array<{ variant: ProductVariant; productName: string }> = products
    .filter(p => p.status !== 'suspended')
    .flatMap(p =>
      p.variants.map(v => ({ variant: v, productName: p.name }))
    );
  const categories = ['all', ...Array.from(new Set(products.filter(p => p.status !== 'suspended').map(p => p.category ?? 'Other').filter(Boolean)))];
  const filteredVariants = filterCategory === 'all'
    ? allVariants
    : allVariants.filter(({ variant }) => {
        const product = products.find(p => p.id === variant.productId);
        return (product?.category ?? 'Other') === filterCategory;
      });

  const { units: totalUnits, revenue: totalRevenue } = getTallyTotal();
  const hasItems = totalUnits > 0;

  // Session cumulative totals (Tally mode) — sum across all confirmed sales this session
  const sessionTotalUnits = Object.values(sessionSold).reduce((s, n) => s + n, 0);
  const sessionTotalRevenue = Object.entries(sessionSold).reduce((sum, [vid, qty]) => {
    // Search in state.products directly to ensure we find even suspended products that were sold
    const v = state.products.flatMap(p => p.variants).find(vv => vv.id === vid);
    return sum + (v ? v.price * qty : 0);
  }, 0);

  // Basket items for modals / preview
  const basketItems = Object.values(tally.items)
    .filter(i => i.qty > 0)
    .map(i => ({ variantId: i.variantId, name: i.variantName, qty: i.qty, unitPrice: i.unitPrice }));

  // Adjust basket qty (used in both preview and modal)
  const handleAdjust = useCallback((variantId: string, variantName: string, unitPrice: number, delta: number) => {
    if (delta > 0) {
      dispatch({ type: 'TALLY_INCREMENT', payload: { variantId, variantName, unitPrice } });
    } else {
      dispatch({ type: 'TALLY_DECREMENT', payload: { variantId, variantName } });
    }
  }, [dispatch]);

  const finishSale = useCallback(async (
    moneyIn: number,
    opts?: Parameters<typeof confirmSale>[0]
  ) => {
    const snapshot = Object.values(tally.items).filter(i => i.qty > 0);
    const batch = await confirmSale(opts);
    if (batch) {
      setSessionSold(prev => {
        const next = { ...prev };
        snapshot.forEach(item => { next[item.variantId] = (next[item.variantId] ?? 0) + item.qty; });
        return next;
      });
      const change = moneyIn > 0 ? moneyIn - batch.totalPrice : 0;
      setShowRegisterModal(false);
      setShowShortfallModal(false);
      setJustConfirmed(true);
      toast.success(
        opts?.shortfallType === 'discount'
          ? `Discount applied · ${symbol}${batch.totalPrice.toFixed(2)}`
          : opts?.shortfallType === 'seller_debt'
          ? `Seller debt recorded · ${symbol}${(opts.shortfallAmount ?? 0).toFixed(2)} owed`
          : moneyIn > 0
          ? `Sale complete! ${symbol}${batch.totalPrice.toFixed(2)} · Change: ${symbol}${change.toFixed(2)}`
          : `Sale confirmed! ${batch.totalItems} items · ${symbol}${batch.totalPrice.toFixed(2)}`,
        { duration: 4000 }
      );
      setTimeout(() => setJustConfirmed(false), 2000);
    }
  }, [confirmSale, tally.items]);

  // Register confirm (with cash amount)
  const handleRegisterConfirm = useCallback(async (moneyIn: number) => {
    if (moneyIn < totalRevenue) {
      setPendingMoneyIn(moneyIn);
      setShowShortfallModal(true);
      return;
    }
    await finishSale(moneyIn);
  }, [finishSale, totalRevenue]);

  const handleShortfallDiscount = useCallback(async (reason?: string) => {
    const shortfall = totalRevenue - pendingMoneyIn;
    await finishSale(pendingMoneyIn, { shortfallType: 'discount', shortfallAmount: shortfall, shortfallReason: reason });
  }, [finishSale, totalRevenue, pendingMoneyIn]);

  const handleShortfallDebt = useCallback(async (memberId: string, memberName: string, reason?: string) => {
    const shortfall = totalRevenue - pendingMoneyIn;
    await finishSale(pendingMoneyIn, { shortfallType: 'seller_debt', shortfallAmount: shortfall, shortfallReason: reason, shortfallMemberId: memberId });
    await recordSellerDebt(memberId, shortfall);
    toast(`${memberName} owes ${symbol}${shortfall.toFixed(2)}`, { duration: 3000 });
  }, [finishSale, recordSellerDebt, totalRevenue, pendingMoneyIn]);

  // Instant sell (Tally mode — single variant, qty=1, immediate confirm)
  const handleInstantSell = useCallback(async (variantId: string, variantName: string, unitPrice: number) => {
    // Guard against oversell: use live currentStock from state.products directly
    const liveVariantCheck = state.products.flatMap(p => p.variants).find(v => v.id === variantId);
    if (!liveVariantCheck || liveVariantCheck.currentStock <= 0) {
      toast.error(`${variantName} — no stock left!`, { duration: 2000 });
      return;
    }

    // Use a fresh tally override to bypass state sync lag
    const instantTally = {
      items: {
        [variantId]: { variantId, variantName, qty: 1, unitPrice }
      },
      lastAction: null
    };

    const batch = await confirmSale({ tallyOverride: instantTally });
    if (batch) {
      // Clear any accidental leftovers for this variant and update session counter
      dispatch({ type: 'TALLY_REMOVE_VARIANT', payload: { variantId } });
      setSessionSold(prev => ({ ...prev, [variantId]: (prev[variantId] ?? 0) + 1 }));
      setJustConfirmed(true);
      toast.success(`${variantName} · ${symbol}${unitPrice.toFixed(2)}`, { duration: 1500 });
      setTimeout(() => setJustConfirmed(false), 1500);
    } else {
      toast.error(`Failed to record sale: no active session found.`, { duration: 3000 });
    }
  }, [dispatch, confirmSale, state.products, symbol]);

  // Mid-sale restock: pull units from warehouse into road stock
  const handleRestock = useCallback(async (variantId: string, productId: string, variantName: string, qty: number) => {
    await transferStock(variantId, productId, variantName, 'to_road', qty, 'Restock during sale');
    toast.success(`Restocked ${qty} × ${variantName} from warehouse`, { duration: 2500 });
  }, [transferStock]);

  function handleConfirmButton() {
    if (!hasItems) return;
    setShowRegisterModal(true);
  }

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(107,92,255,0.12)' }}>
          <Zap size={28} className="text-[#7C6DFF]" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-black text-[#E6E7EB] mb-1">No Active Session</h2>
          <p className="text-sm text-[#7B7F93]">Start a sale session from Merch Office to begin tallying.</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6B5CFF 0%, #C026D3 100%)' }}>
          Go to Merch Office
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Stop Sale confirmation modal */}
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
      <div className="mp-tally-session-bar px-4 py-2.5 flex items-center justify-between gap-2"
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

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Basket preview button — Register mode only */}
          {!tallyMode && (
            <button
              onClick={() => setShowBasketPreview(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 relative"
              style={{
                background: hasItems ? 'rgba(107,92,255,0.2)' : 'rgba(45,48,72,0.4)',
                border: `1px solid ${hasItems ? 'rgba(107,92,255,0.4)' : '#2D3048'}`,
                color: hasItems ? '#A78BFA' : '#7B7F93',
              }}>
              <Eye size={11} />
              {hasItems && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white"
                  style={{ background: '#6B5CFF' }}>
                  {totalUnits}
                </span>
              )}
            </button>
          )}

          {/* TALLY / REGISTER pill toggle */}
          <div className="flex items-center rounded-xl overflow-hidden"
            style={{ border: '1px solid #2D3048', background: '#0E0F14' }}>
            <button
              onClick={() => { setMode('tally'); setSetting('tallyMode', 'tally'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-all"
              style={tallyMode
                ? { background: 'rgba(107,92,255,0.25)', color: '#A78BFA' }
                : { color: '#7B7F93' }}>
              <Zap size={11} /> Tally
            </button>
            <div className="w-px h-4 bg-[#2D3048]" />
            <button
              onClick={() => { setMode('register'); setSetting('tallyMode', 'register'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-all"
              style={!tallyMode
                ? { background: 'rgba(74,222,128,0.2)', color: '#4ADE80' }
                : { color: '#7B7F93' }}>
              <ShoppingBag size={11} /> Register
            </button>
          </div>

          {/* LIVE indicator + Stop Sale */}
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

      {/* Mode indicator banner */}
      {tallyMode ? (
        <div className="mp-tally-mode-banner mx-4 mt-2 px-3 py-2 rounded-xl flex items-center gap-2 animate-fade-in"
          style={{ background: 'rgba(107,92,255,0.06)', border: '1px solid rgba(107,92,255,0.15)' }}>
          <Zap size={12} className="text-[#7C6DFF] flex-shrink-0" />
          <span className="text-xs text-[#7C6DFF] font-semibold">Tally Mode</span>
          <span className="text-xs text-[#7B7F93]">— tap + to instantly record each sale</span>
        </div>
      ) : (
        <div className="mp-tally-mode-banner mx-4 mt-2 px-3 py-2 rounded-xl flex items-center gap-2 animate-fade-in"
          style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <ShoppingBag size={12} className="text-[#4ADE80] flex-shrink-0" />
          <span className="text-xs text-[#4ADE80] font-semibold">Register Mode</span>
          <span className="text-xs text-[#7B7F93]">— build basket, then confirm with cash drawer</span>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
          {categories.map(cat => (
            <button key={cat} onClick={() => { setFilterCategory(cat); setSetting('tallyFilterCategory', cat); }}
              className={cn('mp-tally-cat-pill flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                filterCategory === cat ? 'mp-tally-cat-pill--active text-white' : 'text-[#7B7F93] hover:text-[#A4A7B5]'
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
            const basketQty = tally.items[variant.id]?.qty ?? 0;
            const liveVariant = products.flatMap(p => p.variants).find(v => v.id === variant.id) ?? variant;
            return (
              <TallyCard
                key={variant.id}
                variant={liveVariant}
                liveStock={liveVariant.currentStock}
                sessionSoldQty={sessionSold[variant.id] ?? 0}
                basketQty={basketQty}
                stockStatus={stockStatus}
                tallyMode={tallyMode}
                effectivelyEmpty={liveVariant.currentStock <= 0}
                onIncrement={() => dispatch({ type: 'TALLY_INCREMENT', payload: { variantId: variant.id, variantName: variant.name, unitPrice: variant.price } })}
                onDecrement={() => dispatch({ type: 'TALLY_DECREMENT', payload: { variantId: variant.id, variantName: variant.name } })}
                onInstantSell={() => handleInstantSell(variant.id, variant.name, variant.price)}
                allowMidSaleRestock={allowMidSaleRestock}
                onRestock={(qty) => handleRestock(variant.id, variant.productId ?? '', variant.name, qty)}
                warehouseStock={liveVariant.warehouseStock ?? 0}
                symbol={symbol}
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
      {(() => {
        const isSticky = tallyMode ? stickyBarTally : stickyBarRegister;
        return (
        <div className={isSticky ? 'fixed left-0 right-0 bottom-16 z-30 px-4 pb-2' : 'px-4 pb-4 mt-4'}>
        <div className={cn(
          'mp-tally-action-bar rounded-2xl p-3 shadow-2xl transition-all duration-300',
        )}
          style={{ background: 'rgba(20,22,36,0.97)', backdropFilter: 'blur(20px)', border: '1px solid #2D3048' }}>
          {/* Totals row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs text-[#7B7F93]">{tallyMode ? 'Sold' : 'Units'}</p>
                <p className="text-lg font-black text-foreground mp-mono leading-none">
                  {tallyMode ? sessionTotalUnits : totalUnits}
                </p>
              </div>
              <div className="w-px h-8 bg-[#24273A]" />
              <div>
                <p className="text-xs text-[#7B7F93]">Total</p>
                <p className="text-lg font-black mp-gradient-text mp-mono leading-none">
                  {symbol}{(tallyMode ? sessionTotalRevenue : totalRevenue).toFixed(2)}
                </p>
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

          {/* Action button — context-aware */}
          {tallyMode ? (
            <div className="mp-tally-mode-hint w-full py-3.5 rounded-xl text-sm font-bold text-center select-none"
              style={{ background: '#1B1E2E', color: '#3D4060', border: '1px solid #1E2030' }}>
              Tally Mode — tap + to sell instantly
            </div>
          ) : (
            <button
              onClick={handleConfirmButton}
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
          )}
        </div>
      </div>
        );
      })()}
      {/* Spacer */}
      <div className="h-60" />

      {/* Basket preview sheet (Register mode) */}
      {showBasketPreview && (
        <BasketPreview
          items={basketItems}
          totalRevenue={totalRevenue}
          symbol={symbol}
          onClose={() => setShowBasketPreview(false)}
          onAdjust={handleAdjust}
        />
      )}

      {/* Register modal (with cash drawer + iOS numpad) */}
      {showRegisterModal && (
        <RegisterModal
          items={basketItems}
          totalRevenue={totalRevenue}
          symbol={symbol}
          requireMoneyInput={settings.requireMoneyInput ?? false}
          onConfirm={handleRegisterConfirm}
          onCancel={() => setShowRegisterModal(false)}
          onAdjust={handleAdjust}
        />
      )}

      {/* Shortfall modal — shown when cash is insufficient */}
      {showShortfallModal && (
        <ShortfallModal
          shortfall={totalRevenue - pendingMoneyIn}
          totalRevenue={totalRevenue}
          symbol={symbol}
          requireDiscountReason={settings.requireDiscountReason ?? true}
          allowSellerDebt={settings.allowSellerDebt ?? true}
          requireDebtReason={settings.requireDebtReason ?? true}
          activeMembers={teamMembers.filter(m => m.active)}
          onDiscount={handleShortfallDiscount}
          onSellerDebt={handleShortfallDebt}
          onGoBack={() => setShowShortfallModal(false)}
          onCancel={() => { setShowShortfallModal(false); setShowRegisterModal(false); }}
        />
      )}
    </div>
  );
}
