import { useState, useMemo } from 'react';
import { Warehouse, Truck, ArrowRight, Plus, Minus, ChevronsRight, RotateCcw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RightDrawer } from './RightDrawer';
import { toast } from 'sonner';
import { useMerchPad } from '@/contexts/MerchPadContext';
import { Product } from '@/lib/db';

interface Props {
  product: Product;
  open: boolean;
  onClose: () => void;
}

type Direction = 'to_road' | 'to_warehouse';

export default function StockTransferModal({ product, open, onClose }: Props) {
  const { state, transferStock } = useMerchPad();
  const { settings } = state;
  const [direction, setDirection] = useState<Direction>('to_road');
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(product.variants.map(v => [v.id, 0]))
  );
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  function sourceStock(v: typeof product.variants[0]) {
    return direction === 'to_road' ? (v.warehouseStock ?? 0) : (v.roadStock ?? v.currentStock);
  }

  function setQty(id: string, val: number) {
    const v = product.variants.find(x => x.id === id)!;
    setQtys(prev => ({ ...prev, [id]: Math.max(0, Math.min(val, sourceStock(v))) }));
  }

  function setMax(id: string) {
    const v = product.variants.find(x => x.id === id)!;
    setQtys(prev => ({ ...prev, [id]: sourceStock(v) }));
  }

  function clearAll() {
    setQtys(Object.fromEntries(product.variants.map(v => [v.id, 0])));
  }

  function fillAll() {
    setQtys(Object.fromEntries(product.variants.map(v => [v.id, sourceStock(v)])));
  }

  const totalUnits = useMemo(() => Object.values(qtys).reduce((s, q) => s + q, 0), [qtys]);
  const hasAny = totalUnits > 0;
  const noteRequired = settings.requireTransferNote;
  const canSubmit = hasAny && (!noteRequired || note.trim().length > 0);

  function switchDirection(d: Direction) {
    setDirection(d);
    clearAll();
  }

  async function handleTransfer() {
    const transfers = product.variants.filter(v => qtys[v.id] > 0);
    if (transfers.length === 0) { toast.error('Set at least one quantity'); return; }
    if (noteRequired && !note.trim()) { toast.error('Please enter a note'); return; }

    setLoading(true);
    try {
      for (const v of transfers) {
        await transferStock(v.id, product.id, v.name, direction, qtys[v.id], note.trim());
      }
      const label = direction === 'to_road' ? 'WH → Road' : 'Road → WH';
      toast.success(`Transferred ${totalUnits} unit${totalUnits !== 1 ? 's' : ''} (${label})`);
      clearAll();
      setNote('');
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <RightDrawer open={open} onClose={onClose} title={product.name} subtitle="Stock Transfer">
      <div className="overflow-y-auto p-3 space-y-3 pb-6">

        {/* Direction picker */}
        <div className="grid grid-cols-2 gap-2">
          {(['to_road', 'to_warehouse'] as Direction[]).map(d => {
            const active = direction === d;
            const isToRoad = d === 'to_road';
            return (
              <button
                key={d}
                onClick={() => switchDirection(d)}
                className="relative flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-all"
                style={{
                  border: active
                    ? `2px solid ${isToRoad ? '#6B5CFF' : '#f59e0b'}`
                    : '2px solid var(--border)',
                  background: active
                    ? isToRoad ? 'rgba(107,92,255,0.08)' : 'rgba(245,158,11,0.08)'
                    : 'var(--muted)',
                }}
              >
                {active && (
                  <div
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                    style={{ background: isToRoad ? '#6B5CFF' : '#f59e0b' }}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  {isToRoad ? (
                    <>
                      <Warehouse size={18} className={active ? 'text-primary' : 'text-muted-foreground'} />
                      <ArrowRight size={13} className={active ? 'text-primary' : 'text-muted-foreground'} />
                      <Truck size={18} className={active ? 'text-primary' : 'text-muted-foreground'} />
                    </>
                  ) : (
                    <>
                      <Truck size={18} className={active ? 'text-amber-500' : 'text-muted-foreground'} />
                      <ArrowRight size={13} className={active ? 'text-amber-500' : 'text-muted-foreground'} />
                      <Warehouse size={18} className={active ? 'text-amber-500' : 'text-muted-foreground'} />
                    </>
                  )}
                </div>
                <span
                  className="text-xs font-bold tracking-wide"
                  style={{ color: active ? (isToRoad ? '#6B5CFF' : '#f59e0b') : 'var(--muted-foreground)' }}
                >
                  {isToRoad ? 'WH → Road' : 'Road → WH'}
                </span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {isToRoad ? 'Load van for the show' : 'Return unsold stock'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variants</span>
          <div className="flex gap-2">
            <button
              onClick={fillAll}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80 transition-opacity"
            >
              <ChevronsRight size={12} /> Move all
            </button>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw size={11} /> Clear
            </button>
          </div>
        </div>

        {/* Variant rows */}
        <div className="space-y-2">
          {product.variants.map(v => {
            const src = sourceStock(v);
            const qty = qtys[v.id] ?? 0;
            const wh = v.warehouseStock ?? 0;
            const road = v.roadStock ?? v.currentStock;
            const newWH = direction === 'to_road' ? wh - qty : wh + qty;
            const newRoad = direction === 'to_road' ? road + qty : road - qty;
            const exhausted = src === 0;

            return (
              <div
                key={v.id}
                className="rounded-xl p-2.5 space-y-2"
                style={{
                  background: 'var(--muted)',
                  opacity: exhausted ? 0.5 : 1,
                }}
              >
                {/* Variant name + stock badges */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{v.name}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-primary"
                      style={{ background: 'rgba(107,92,255,0.12)' }}>
                      WH {wh}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-green-500"
                      style={{ background: 'rgba(34,197,94,0.12)' }}>
                      Road {road}
                    </span>
                  </div>
                </div>

                {/* Stepper + Max */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty(v.id, qty - 1)}
                    disabled={qty === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors flex-shrink-0"
                    style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                  >
                    <Minus size={13} />
                  </button>

                  <input
                    type="number"
                    min={0}
                    max={src}
                    value={qty === 0 ? '' : qty}
                    placeholder="0"
                    disabled={exhausted}
                    onChange={e => setQty(v.id, parseInt(e.target.value) || 0)}
                    className="flex-1 h-8 text-center text-sm font-bold rounded-lg outline-none focus:ring-1 ring-primary bg-transparent text-foreground"
                    style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                  />

                  <button
                    onClick={() => setQty(v.id, qty + 1)}
                    disabled={qty >= src || exhausted}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors flex-shrink-0"
                    style={{ border: '1px solid var(--border)', background: 'var(--background)' }}
                  >
                    <Plus size={13} />
                  </button>

                  <button
                    onClick={() => setMax(v.id)}
                    disabled={exhausted || qty === src}
                    className="px-2 h-8 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-30 flex-shrink-0"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    Max
                  </button>
                </div>

                {/* After-transfer preview */}
                {qty > 0 && (
                  <div className="flex items-center gap-2 text-[11px] font-medium pt-1 border-t"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="text-muted-foreground">After:</span>
                    <span className="text-primary">WH {newWH}</span>
                    <ArrowRight size={10} className="text-muted-foreground/40" />
                    <span className="text-green-500">Road {newRoad}</span>
                  </div>
                )}

                {exhausted && (
                  <p className="text-[11px] text-muted-foreground">
                    No {direction === 'to_road' ? 'warehouse' : 'road'} stock available
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Note */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5">
            <FileText size={15} className="text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Transfer Note {noteRequired && <span className="text-red-500">*</span>}
            </span>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={noteRequired ? "Required reason for transfer..." : "Optional transfer note..."}
            className="w-full bg-muted border border-border rounded-xl p-3.5 text-sm focus:ring-1 ring-primary outline-none resize-none transition-all"
            rows={2}
          />
        </div>

        {/* Confirm button */}
        <div className="space-y-2">
          {hasAny && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total moving</span>
              <span className="font-bold text-foreground mp-mono">{totalUnits} unit{totalUnits !== 1 ? 's' : ''}</span>
            </div>
          )}
          <Button
            onClick={handleTransfer}
            disabled={!canSubmit || loading}
            className="w-full font-bold text-white"
            style={{
              background: canSubmit
                ? direction === 'to_road'
                  ? 'linear-gradient(to right, #6B5CFF, #c026d3)'
                  : 'linear-gradient(to right, #f59e0b, #ea580c)'
                : undefined,
            }}
          >
            {loading
              ? 'Transferring…'
              : !hasAny
                ? 'Set quantities above'
                : noteRequired && !note.trim()
                  ? 'Note required'
                  : `${direction === 'to_road' ? 'Load Van' : 'Return to WH'} · ${totalUnits} unit${totalUnits !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}
