/**
 * Merch Office — pre-show preparation screen
 * Design: "Neon Ledger" — dark glass cards, Moshly accent colors
 * Features: items editor, show selector, stats summary, past registers
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Play, ChevronDown, ChevronUp, Package, Calendar, TrendingUp, X, Check, Zap, BookOpen, Sparkles, AlertCircle, ArrowRightLeft, Warehouse, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { Product, ProductVariant, Show, getDB } from '../lib/db';
import { cn } from '../lib/utils';
import { loadCatalogue, CatalogueTemplate } from '../lib/catalogue';
import StockTransferModal from '../components/StockTransferModal';
import { AdjustmentModal } from './DetailInfo';
import { RightDrawer } from '../components/RightDrawer';
import TeamSection from '../components/TeamSection';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(n: number) {
  return `€${n.toFixed(2)}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Product Editor Modal ───────────────────────────────────────────────────

interface ProductEditorProps {
  product?: Product;
  onSave: (p: Product) => void;
  onClose: () => void;
}

function ProductEditor({ product, onSave, onClose }: ProductEditorProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [bulkBase, setBulkBase] = useState('');
  const [bulkAttr, setBulkAttr] = useState('');
  const [bulkValues, setBulkValues] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [nameWarning, setNameWarning] = useState<string | null>(null);

  // Load catalogue for autocomplete + template picker
  const catalogue = useMemo(() => loadCatalogue(), []);
  const catalogueNames = useMemo(() => catalogue.map(t => t.name), [catalogue]);
  const catalogueCategories = useMemo(() => Array.from(new Set(catalogue.map(t => t.category))).sort(), [catalogue]);

  // Typo / duplicate name check
  function checkName(val: string) {
    setName(val);
    if (!val.trim()) { setNameWarning(null); return; }
    // Fuzzy check: warn if a catalogue template name is very similar (edit distance ≤ 2)
    const lower = val.trim().toLowerCase();
    const similar = catalogueNames.find(n => {
      const nl = n.toLowerCase();
      if (nl === lower) return false; // exact match is fine
      // Simple check: one is a prefix of the other, or differs by ≤ 2 chars
      if (nl.startsWith(lower) || lower.startsWith(nl)) return true;
      let diff = 0;
      const maxLen = Math.max(nl.length, lower.length);
      for (let i = 0; i < maxLen; i++) { if (nl[i] !== lower[i]) diff++; }
      return diff <= 2 && maxLen > 3;
    });
    setNameWarning(similar ? `Did you mean "${similar}"? Check the catalogue to avoid duplicates.` : null);
  }

  // Apply a catalogue template
  function applyTemplate(t: CatalogueTemplate) {
    setName(t.name);
    setCategory(t.category);
    setNameWarning(null);
    // Pre-fill bulk generator with first axis
    if (t.variantAxes.length > 0) {
      const axis = t.variantAxes[0];
      setBulkBase(t.name);
      setBulkAttr(axis.key);
      setBulkValues(axis.values.join(', '));
      setBulkPrice(String(t.defaultPrice));
    }
    toast.success(`Template "${t.name}" applied — review and generate variants`);
  }

  function addVariant() {
    const v: ProductVariant = {
      id: uuidv4(),
      productId: product?.id ?? '',
      name: `${name || 'Product'} Variant`,
      attributes: {},
      price: 0,
      initialStock: 0,
      currentStock: 0,
      warehouseStock: 0,
      roadStock: 0,
    };
    setVariants(prev => [...prev, v]);
  }

  function bulkGenerate() {
    if (!bulkBase || !bulkAttr || !bulkValues) {
      toast.error('Fill in base name, attribute key, and values before generating');
      return;
    }
    const vals = bulkValues.split(',').map(v => v.trim()).filter(Boolean);
    if (vals.length === 0) { toast.error('Enter at least one value'); return; }
    const price = parseFloat(bulkPrice);
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return; }
    const stock = parseInt(bulkStock);
    if (isNaN(stock) || stock < 0) { toast.error('Enter a valid stock quantity'); return; }
    const newVariants: ProductVariant[] = vals.map(val => ({
      id: uuidv4(),
      productId: product?.id ?? '',
      name: `${bulkBase} ${val}`,
      attributes: { [bulkAttr.trim().toLowerCase()]: val },
      price,
      initialStock: stock,
      currentStock: stock,
      warehouseStock: 0,
      roadStock: stock,
    }));
    setVariants(prev => [...prev, ...newVariants]);
    setBulkBase(''); setBulkAttr(''); setBulkValues(''); setBulkPrice(''); setBulkStock('');
    toast.success(`Generated ${newVariants.length} variants`);
  }

  function updateVariant(id: string, field: keyof ProductVariant, value: unknown) {
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  }

  function removeVariant(id: string) {
    setVariants(prev => prev.filter(v => v.id !== id));
  }

  function handleSave() {
    if (!name.trim()) { toast.error('Product name required'); return; }
    const pid = product?.id ?? uuidv4();
    const now = new Date().toISOString();
    const p: Product = {
      id: pid,
      name: name.trim(),
      category: category.trim() || undefined,
      variants: variants.map(v => ({ ...v, productId: pid })),
      createdAt: product?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(p);
  }

  return (
    <RightDrawer open={true} onClose={onClose} title={product ? 'Edit Product' : 'New Product'} className="max-w-md">

        <div className="p-4 space-y-4">

          {/* Catalogue template picker */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,229,255,0.2)', background: 'rgba(0,229,255,0.04)' }}>
            <button onClick={() => setShowCatPicker(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left">
              <div className="flex items-center gap-2">
                <BookOpen size={14} style={{ color: '#00E5FF' }} />
                <span className="text-xs font-semibold" style={{ color: '#00E5FF' }}>Pick from Item Template Creator</span>
              </div>
              <span className="text-[10px] text-[#7B7F93]">{showCatPicker ? 'Hide' : `${catalogue.length} templates`}</span>
            </button>
            {showCatPicker && (
              <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
                {catalogue.map(t => (
                  <button key={t.id} onClick={() => { applyTemplate(t); setShowCatPicker(false); }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-[rgba(0,229,255,0.08)]">
                    <div>
                      <p className="text-sm font-semibold text-[#E6E7EB]">{t.name}</p>
                      <p className="text-[10px] text-[#7B7F93]">{t.category} · {t.variantAxes.map(a => a.key).join(', ') || 'no axes'}</p>
                    </div>
                    <span className="text-xs font-bold text-[#7B7F93]">€{t.defaultPrice.toFixed(2)}</span>
                  </button>
                ))}
                {catalogue.length === 0 && (
                  <p className="text-xs text-[#7B7F93] py-2 text-center">No templates yet — add them in Settings → Item Template Creator</p>
                )}
              </div>
            )}
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Product Name</label>
              <input value={name} onChange={e => checkName(e.target.value)}
                placeholder="T-Shirt"
                list="catalogue-name-suggestions"
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border focus:outline-none transition-colors',
                  nameWarning ? 'border-[#FBBF24] focus:border-[#FBBF24]' : 'border-[#2D3048] focus:border-[#6B5CFF]'
                )} />
              <datalist id="catalogue-name-suggestions">
                {catalogueNames.map(n => <option key={n} value={n} />)}
              </datalist>
              {nameWarning && (
                <div className="flex items-start gap-1.5 mt-1.5">
                  <AlertCircle size={11} className="text-[#FBBF24] flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#FBBF24]">{nameWarning}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)}
                placeholder="Apparel"
                list="catalogue-category-suggestions"
                className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none transition-colors" />
              <datalist id="catalogue-category-suggestions">
                {catalogueCategories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Bulk generator */}
          <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(107,92,255,0.06)', border: '1px solid rgba(107,92,255,0.2)' }}>
            <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-wider">⚡ Bulk Variant Generator</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={bulkBase} onChange={e => setBulkBase(e.target.value)}
                placeholder="Base name (e.g. T-Shirt Black)"
                className="col-span-2 px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
              <div className="relative">
                <input value={bulkAttr} onChange={e => setBulkAttr(e.target.value)}
                  placeholder="Attribute (e.g. size)"
                  list="bulk-attr-suggestions"
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
                <datalist id="bulk-attr-suggestions">
                  {Array.from(new Set(catalogue.flatMap(t => t.variantAxes.map(a => a.key)))).map(k => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </div>
              <div className="relative">
                <input value={bulkValues} onChange={e => setBulkValues(e.target.value)}
                  placeholder="Values (e.g. M, L, XL)"
                  className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
                {/* Show suggested values from catalogue when axis key matches */}
                {bulkAttr && (() => {
                  const axisKey = bulkAttr.trim().toLowerCase();
                  const suggested = Array.from(new Set(
                    catalogue.flatMap(t => t.variantAxes.filter(a => a.key === axisKey).flatMap(a => a.values))
                  ));
                  return suggested.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {suggested.map(v => (
                        <button key={v} type="button"
                          onClick={() => setBulkValues(prev => prev ? `${prev}, ${v}` : v)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                          style={{ background: 'rgba(107,92,255,0.15)', color: '#7C6DFF', border: '1px solid rgba(107,92,255,0.3)' }}>
                          + {v}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              <input value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                placeholder="Price (€)"
                type="number" min="0" step="0.01"
                className="px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
              <input value={bulkStock} onChange={e => setBulkStock(e.target.value)}
                placeholder="Initial stock"
                type="number" min="0"
                className="px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
            </div>
            <button onClick={bulkGenerate}
              className="w-full py-2 rounded-lg text-sm font-semibold text-[#7C6DFF] transition-colors hover:bg-[rgba(107,92,255,0.12)]"
              style={{ border: '1px solid rgba(107,92,255,0.3)' }}>
              Generate Variants
            </button>
          </div>

          {/* Variants list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Variants ({variants.length})</p>
              <button onClick={addVariant} className="flex items-center gap-1 text-xs text-[#7C6DFF] hover:text-[#6B5CFF]">
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {variants.map(v => (
                <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: '#1B1E2E', border: '1px solid #24273A' }}>
                  <input value={v.name} onChange={e => updateVariant(v.id, 'name', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 rounded text-sm text-[#E6E7EB] bg-transparent focus:outline-none" />
                  <input value={v.price} onChange={e => updateVariant(v.id, 'price', parseFloat(e.target.value) || 0)}
                    type="number" min="0" step="0.01" placeholder="€"
                    className="w-16 px-2 py-1 rounded text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#24273A] focus:outline-none text-right" />
                  <input value={v.currentStock} onChange={e => { const n = parseInt(e.target.value) || 0; updateVariant(v.id, 'currentStock', n); updateVariant(v.id, 'initialStock', n); }}
                    type="number" min="0" placeholder="Stock"
                    className="w-16 px-2 py-1 rounded text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#24273A] focus:outline-none text-right" />
                  <button onClick={() => removeVariant(v.id)} className="text-[#7B7F93] hover:text-[#F87171] p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {variants.length === 0 && (
                <p className="text-sm text-[#7B7F93] text-center py-4">No variants yet. Use the bulk generator or add manually.</p>
              )}
            </div>
          </div>
        </div>

      <div className="flex gap-2 p-4 border-t border-[#24273A] flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5] hover:text-[#E6E7EB] transition-colors"
          style={{ border: '1px solid #2D3048' }}>
          Cancel
        </button>
        <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
          Save Product
        </button>
      </div>
    </RightDrawer>
  );
}

// ── Show Selector ──────────────────────────────────────────────────────────

interface ShowSelectorProps {
  shows: Show[];
  selectedShowId: string;
  onSelect: (id: string) => void;
  onNewShow: () => void;
}

function ShowSelector({ shows, selectedShowId, onSelect, onNewShow }: ShowSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = shows.find(s => s.id === selectedShowId);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors"
        style={{ background: '#1B1E2E', border: '1px solid #2D3048' }}>
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-[#6B5CFF]" />
          {selected ? (
            <div>
              <p className="text-sm font-semibold text-[#E6E7EB]">{selected.name}</p>
              <p className="text-xs text-[#7B7F93]">{selected.venue} · {formatDate(selected.date)}</p>
            </div>
          ) : (
            <p className="text-sm text-[#7B7F93]">Select a show</p>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-[#7B7F93]" /> : <ChevronDown size={16} className="text-[#7B7F93]" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10 shadow-2xl"
          style={{ background: '#141624', border: '1px solid #2D3048' }}>
          {shows.map(s => (
            <button key={s.id} onClick={() => { onSelect(s.id); setOpen(false); }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1B1E2E] transition-colors',
                s.id === selectedShowId && 'bg-[rgba(107,92,255,0.1)]')}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#E6E7EB] truncate">{s.name}</p>
                <p className="text-xs text-[#7B7F93]">{s.venue} · {formatDate(s.date)}</p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                s.status === 'upcoming' ? 'text-[#4ADE80] bg-[rgba(74,222,128,0.1)]' :
                s.status === 'active' ? 'text-[#7C6DFF] bg-[rgba(107,92,255,0.1)]' :
                'text-[#7B7F93] bg-[rgba(123,127,147,0.1)]')}>
                {s.status}
              </span>
            </button>
          ))}
          <button onClick={() => { onNewShow(); setOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#7C6DFF] hover:bg-[#1B1E2E] transition-colors border-t border-[#24273A]">
            <Plus size={14} /> New Show
          </button>
        </div>
      )}
    </div>
  );
}

// ── New Show Modal ─────────────────────────────────────────────────────────

function NewShowModal({ onSave, onClose }: { onSave: (s: Show) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  function handleSave() {
    if (!name.trim() || !venue.trim()) { toast.error('Name and venue required'); return; }
    const show: Show = {
      id: uuidv4(),
      name: name.trim(),
      venue: venue.trim(),
      city: city.trim() || undefined,
      date,
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };
    onSave(show);
  }

  return (
    <RightDrawer open={true} onClose={onClose} title="New Show">
      <div className="p-4 space-y-3">
        {[
          { label: 'Show Name', val: name, set: setName, ph: 'Summer Tour 2026' },
          { label: 'Venue', val: venue, set: setVenue, ph: 'Altice Arena' },
          { label: 'City', val: city, set: setCity, ph: 'Lisbon' },
        ].map(({ label, val, set, ph }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">{label}</label>
            <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
              className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t border-[#24273A] flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]" style={{ border: '1px solid #2D3048' }}>Cancel</button>
        <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">Save Show</button>
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
      <div className="p-4 space-y-3">
        <p className="text-sm text-[#A4A7B5]">This will snapshot the current stock for your stand. Stock stroke colors will reflect this allocation.</p>
        <div>
          <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Your Name</label>
          <input value={repName} onChange={e => setRepName(e.target.value)} placeholder="João"
            className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Stand / Location (optional)</label>
          <input value={stand} onChange={e => setStand(e.target.value)} placeholder="Stand A"
            className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t border-[#24273A] flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]" style={{ border: '1px solid #2D3048' }}>Cancel</button>
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
  secPastShows: boolean;
  setSecPastShows: (v: (prev: boolean) => boolean) => void;
  expandedPastShow: string | null;
  setExpandedPastShow: (id: string | null) => void;
  pastShowStats: Record<string, { sessions: number; items: number; revenue: number }>;
  setPastShowStats: React.Dispatch<React.SetStateAction<Record<string, { sessions: number; items: number; revenue: number }>>>;
  onDelete: (showId: string) => Promise<void>;
}
function PastShowsSection({ shows, secPastShows, setSecPastShows, expandedPastShow, setExpandedPastShow, pastShowStats, setPastShowStats, onDelete }: PastShowsSectionProps) {
  useEffect(() => {
    if (!shows.length) return;
    async function loadStats() {
      const db = await getDB();
      const allBatches = await db.getAll('tallyBatches');
      const allSessions = await db.getAll('sessions');
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
  }, [shows, setPastShowStats]);

  if (!shows.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setSecPastShows(v => !v)} className="flex items-center gap-1.5 group">
          <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Past Shows</p>
          <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secPastShows ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
        </button>
        <span className="text-[10px] text-[#7B7F93]">{shows.length} show{shows.length !== 1 ? 's' : ''}</span>
      </div>
      {secPastShows && (
        <div className="space-y-2">
          {shows.map(show => {
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
                      <p className="text-sm font-semibold text-[#E6E7EB] truncate">{show.name}</p>
                      <p className="text-xs text-[#7B7F93] truncate">{show.venue}{show.city ? ` · ${show.city}` : ''} · {show.date}</p>
                    </div>
                    {!isExpanded && stats && (
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <span className="text-xs font-bold mp-mono text-green-400">€{stats.revenue.toFixed(0)}</span>
                        <span className="text-xs text-[#7B7F93]">{stats.items} items</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(show.id)}
                    className="flex-shrink-0 ml-2 w-7 h-7 flex items-center justify-center rounded-lg text-[#F87171] hover:bg-[rgba(248,113,113,0.12)] transition-colors"
                    style={{ border: '1px solid rgba(248,113,113,0.25)' }}
                    title="Permanently delete show">
                    <Trash2 size={13} />
                  </button>
                </div>
                {/* Expanded stats */}
                {isExpanded && (
                  <div className="border-t border-[#24273A] p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(14,15,20,0.5)' }}>
                        <p className="text-[10px] text-[#7B7F93] uppercase tracking-wider mb-0.5">Sessions</p>
                        <p className="text-base font-black mp-mono text-[#E6E7EB]">{stats?.sessions ?? '—'}</p>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(14,15,20,0.5)' }}>
                        <p className="text-[10px] text-[#7B7F93] uppercase tracking-wider mb-0.5">Items</p>
                        <p className="text-base font-black mp-mono text-[#E6E7EB]">{stats?.items ?? '—'}</p>
                      </div>
                      <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(14,15,20,0.5)' }}>
                        <p className="text-[10px] text-[#7B7F93] uppercase tracking-wider mb-0.5">Revenue</p>
                        <p className="text-base font-black mp-mono text-green-400">€{stats?.revenue.toFixed(0) ?? '—'}</p>
                      </div>
                    </div>
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
  const { state, saveProduct, deleteProduct, saveShow, deleteShow, startSession, startOneOffSession, adjustStock } = useMerchPad();
  const { products, shows, activeSession, isLoading } = state;

  const [selectedShowId, setSelectedShowId] = useState(shows.find(s => s.status === 'upcoming')?.id ?? shows[0]?.id ?? '');
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);
  const [showNewShow, setShowNewShow] = useState(false);
  const [showStartSale, setShowStartSale] = useState(false);
  const [showOneOff, setShowOneOff] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Product | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [expandedStockProduct, setExpandedStockProduct] = useState<Set<string>>(() => new Set());
  // Collapsible section state (all open by default)
  const [secShow, setSecShow] = useState(true);
  const [secProducts, setSecProducts] = useState(true);
  const [secStock, setSecStock] = useState(true);
  const [secPastShows, setSecPastShows] = useState(true);
  const [expandedPastShow, setExpandedPastShow] = useState<string | null>(null);
  const [pastShowStats, setPastShowStats] = useState<Record<string, { sessions: number; items: number; revenue: number }>>({});
  const [secTeam, setSecTeam] = useState(true);
  // Stock adjustment
  const [adjustingVariant, setAdjustingVariant] = useState<{
    variantId: string; productId: string; variantName: string; currentStock: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedShowId && shows.length > 0) {
      setSelectedShowId(shows.find(s => s.status === 'upcoming')?.id ?? shows[0].id);
    }
  }, [shows, selectedShowId]);

  // Stats
  const totalVariants = products.reduce((s, p) => s + p.variants.length, 0);
  const totalStockValue = products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.currentStock * v.price, 0), 0);
  const totalUnits = products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.currentStock, 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#6B5CFF] border-t-transparent animate-spin mx-auto" />
          <p className="text-sm text-[#7B7F93]">Loading MerchPad…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden px-4 pt-4 pb-3"
        style={{
          background: `linear-gradient(to bottom, rgba(14,15,20,0) 0%, #0E0F14 100%), url(https://d2xsxph8kpxj0f.cloudfront.net/310519663361417877/U3ZSLTmW8mQsvZ2KUYsYhR/merchpad-hero-bg-QTNZkgshAugSQaW8YVe4nh.webp) center/cover no-repeat`,
          minHeight: 100,
        }}>
        <div className="relative z-10">
          <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-widest mb-1">Merch Office</p>
          <h1 className="text-2xl font-black text-[#E6E7EB] leading-tight" style={{ letterSpacing: '-0.03em' }}>
            Pre-Show Prep
          </h1>
        </div>
      </div>

      <div className="px-4 space-y-4 -mt-2">
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Products', value: products.length, sub: `${totalVariants} variants` },
            { label: 'Units', value: totalUnits, sub: 'in stock' },
            { label: 'Stock Value', value: formatCurrency(totalStockValue), sub: 'at retail' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="mp-card p-3 text-center">
              <p className="text-xs text-[#7B7F93] uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xl font-black text-[#E6E7EB] leading-none mp-mono">{value}</p>
              <p className="text-xs text-[#7B7F93] mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Show selector */}
        <div>
          <button onClick={() => setSecShow(v => !v)} className="flex items-center justify-between w-full mb-2 group">
            <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Show</p>
            <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secShow ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
          </button>
          {secShow && <ShowSelector
            shows={shows}
            selectedShowId={selectedShowId}
            onSelect={setSelectedShowId}
            onNewShow={() => setShowNewShow(true)}
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
            </div>
            <button onClick={() => navigate('/tally')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white mp-btn-primary flex items-center gap-1.5">
              <Zap size={14} /> Go to Tally
            </button>
          </div>
        )}

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setSecProducts(v => !v)} className="flex items-center gap-1.5 group">
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Products</p>
              <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secProducts ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
            </button>
            <button onClick={() => setEditingProduct('new')}
              className="flex items-center gap-1 text-xs font-semibold text-[#7C6DFF] hover:text-[#6B5CFF] transition-colors">
              <Plus size={13} /> Add Product
            </button>
          </div>

          {secProducts && <div className="space-y-2">
            {products.map(product => (
              <div key={product.id} className="mp-card overflow-hidden">
                <button
                  onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                  className="w-full flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(107,92,255,0.12)' }}>
                      <Package size={14} className="text-[#7C6DFF]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#E6E7EB]">{product.name}</p>
                      <p className="text-xs text-[#7B7F93]">{product.variants.length} variants · {product.category ?? 'Uncategorised'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#E6E7EB] mp-mono">
                      {product.variants.reduce((s, v) => s + v.currentStock, 0)} units
                    </span>
                    {expandedProduct === product.id ? <ChevronUp size={14} className="text-[#7B7F93]" /> : <ChevronDown size={14} className="text-[#7B7F93]" />}
                  </div>
                </button>

                {expandedProduct === product.id && (
                  <div className="border-t border-[#24273A]">
                    <div className="p-3 space-y-1.5">
                      {/* Column headers */}
                      <div className="flex items-center justify-between px-2 pb-1">
                        <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">Variant</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider w-12 text-right">Price</span>
                          <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider w-8 text-right">WH</span>
                          <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider w-8 text-right">Road</span>
                        </div>
                      </div>
                      {product.variants.map(v => (
                        <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: 'rgba(14,15,20,0.4)' }}>
                          <span className="text-sm text-[#A4A7B5]">{v.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#7B7F93] mp-mono w-12 text-right">{formatCurrency(v.price)}</span>
                            <span className="text-sm font-bold mp-mono text-purple-300 w-8 text-right">{v.warehouseStock ?? 0}</span>
                            <span className={cn('text-sm font-bold mp-mono w-8 text-right',
                              (v.roadStock ?? v.currentStock) <= 0 ? 'text-[#F87171]' :
                              (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.1 ? 'text-[#F87171]' :
                              (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.3 ? 'text-[#FBBF24]' :
                              'text-[#4ADE80]')}>
                              {v.roadStock ?? v.currentStock}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Two-tier stock summary */}
                    <div className="mx-3 mb-2 p-2 rounded-lg flex items-center justify-between text-xs"
                      style={{ background: 'rgba(14,15,20,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="flex items-center gap-1.5 text-purple-300">
                        <Warehouse size={11} />
                        <span>WH: {product.variants.reduce((s, v) => s + (v.warehouseStock ?? 0), 0)}</span>
                      </div>
                      <ArrowRightLeft size={10} className="text-white/20" />
                      <div className="flex items-center gap-1.5 text-green-300">
                        <Truck size={11} />
                        <span>Road: {product.variants.reduce((s, v) => s + (v.roadStock ?? v.currentStock), 0)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 p-3 pt-0">
                      <button onClick={() => setEditingProduct(product)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#A4A7B5] hover:text-[#E6E7EB] transition-colors"
                        style={{ border: '1px solid #2D3048' }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => { setTransferProduct(product); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors"
                        style={{ border: '1px solid rgba(124,109,255,0.3)' }}>
                        <ArrowRightLeft size={12} /> Transfer
                      </button>
                      <button onClick={() => { if (confirm(`Delete ${product.name}?`)) deleteProduct(product.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#F87171] hover:bg-[rgba(248,113,113,0.1)] transition-colors"
                        style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
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
        {state.teamMembers.filter(m => m.active).length > 0 && (
          <div>
            <button onClick={() => setSecTeam(v => !v)} className="flex items-center gap-1.5 group mb-2">
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Team</p>
              <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secTeam ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
            </button>
            {secTeam && <TeamSection />}
          </div>
        )}

        {/* Stock Management */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setSecStock(v => !v)} className="flex items-center gap-1.5 group">
              <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Stock Management</p>
              <span className="text-[#7B7F93] group-hover:text-[#A4A7B5] transition-colors">{secStock ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</span>
            </button>
          </div>
          {secStock && (
            <div className="space-y-2">
              {products.map(product => {
                const isExpanded = expandedStockProduct.has(product.id);
                const totalRoad = product.variants.reduce((s, v) => s + (v.roadStock ?? v.currentStock), 0);
                const totalWH = product.variants.reduce((s, v) => s + (v.warehouseStock ?? 0), 0);
                return (
                  <div key={product.id} className="mp-card overflow-hidden">
                    {/* Collapsible header — use div to avoid nested <button> */}
                    <div className="p-3 flex items-center justify-between">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedStockProduct(prev => {
                          const next = new Set(prev);
                          if (next.has(product.id)) next.delete(product.id); else next.add(product.id);
                          return next;
                        })}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedStockProduct(prev => { const next = new Set(prev); if (next.has(product.id)) next.delete(product.id); else next.add(product.id); return next; }); } }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <span className="text-[#7B7F93] flex-shrink-0">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#E6E7EB] truncate">{product.name}</p>
                          <p className="text-xs text-[#7B7F93]">{product.variants.length} variants</p>
                        </div>
                        {!isExpanded && (
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs font-bold mp-mono text-purple-300">{totalWH} WH</span>
                            <span className="text-xs font-bold mp-mono text-green-400">{totalRoad} Road</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setTransferProduct(product)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors flex-shrink-0 ml-2"
                        style={{ border: '1px solid rgba(124,109,255,0.3)' }}>
                        <ArrowRightLeft size={11} /> Transfer
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-[#24273A] p-3 space-y-1.5">
                        <div className="flex items-center justify-between px-2 pb-1">
                          <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">Variant</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-wider w-8 text-right">WH</span>
                            <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider w-8 text-right">Road</span>
                            <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider w-8 text-right">Adj</span>
                          </div>
                        </div>
                        {product.variants.map(v => (
                          <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                            style={{ background: 'rgba(14,15,20,0.4)' }}>
                            <span className="text-sm text-[#A4A7B5]">{v.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold mp-mono text-purple-300 w-8 text-right">{v.warehouseStock ?? 0}</span>
                              <span className={`text-sm font-bold mp-mono w-8 text-right ${
                                (v.roadStock ?? v.currentStock) <= 0 ? 'text-[#F87171]' :
                                (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.1 ? 'text-[#F87171]' :
                                (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.3 ? 'text-[#FBBF24]' :
                                'text-[#4ADE80]'}`}>
                                {v.roadStock ?? v.currentStock}
                              </span>
                              <button
                                onClick={() => setAdjustingVariant({ variantId: v.id, productId: product.id, variantName: v.name, currentStock: v.currentStock })}
                                className="w-8 h-7 flex items-center justify-center rounded-lg text-xs font-bold text-[#7C6DFF] hover:text-white hover:bg-[rgba(124,109,255,0.15)] transition-colors"
                                style={{ border: '1px solid rgba(124,109,255,0.25)' }}>
                                <Edit2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {products.length === 0 && (
                <div className="mp-card p-6 text-center">
                  <p className="text-sm text-[#7B7F93]">No products to manage</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Past shows summary */}
        <PastShowsSection
          shows={shows.filter(s => s.status === 'completed' || s.status === 'archived')}
          secPastShows={secPastShows}
          setSecPastShows={setSecPastShows}
          expandedPastShow={expandedPastShow}
          setExpandedPastShow={setExpandedPastShow}
          pastShowStats={pastShowStats}
          setPastShowStats={setPastShowStats}
          onDelete={async (showId) => {
            if (!confirm('Permanently delete this show and all its data? This cannot be undone.')) return;
            await deleteShow(showId);
            toast.success('Show deleted');
          }}
        />

        <div className="h-4" />
      </div>

      {/* Modals */}
      {adjustingVariant && (
        <AdjustmentModal
          {...adjustingVariant}
          onSave={async (delta, reason, notes) => {
            await adjustStock(adjustingVariant.variantId, adjustingVariant.productId, adjustingVariant.variantName, delta, reason, notes);
            setAdjustingVariant(null);
          }}
          onClose={() => setAdjustingVariant(null)}
        />
      )}
      {editingProduct !== null && (
        <ProductEditor
          product={editingProduct !== 'new' ? (editingProduct as Product) : undefined}
          onSave={async (p) => { await saveProduct(p); setEditingProduct(null); toast.success(`${p.name} saved`); }}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {showNewShow && (
        <NewShowModal
          onSave={async (s) => { await saveShow(s); setSelectedShowId(s.id); setShowNewShow(false); toast.success('Show added'); }}
          onClose={() => setShowNewShow(false)}
        />
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
      {transferProduct && (
        <StockTransferModal
          product={transferProduct}
          open={true}
          onClose={() => setTransferProduct(null)}
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
      <div className="p-4 space-y-4">
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
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
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
