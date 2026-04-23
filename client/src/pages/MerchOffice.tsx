/**
 * Merch Office — pre-show preparation screen
 * Design: "Neon Ledger" — dark glass cards, Moshly accent colors
 * Features: items editor, show selector, stats summary, past registers
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Play, ChevronDown, ChevronUp, Package, Calendar, TrendingUp, X, Check, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { Product, ProductVariant, Show } from '../lib/db';
import { cn } from '../lib/utils';

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

  function addVariant() {
    const v: ProductVariant = {
      id: uuidv4(),
      productId: product?.id ?? '',
      name: `${name} Variant`,
      attributes: {},
      price: 0,
      initialStock: 0,
      currentStock: 0,
    };
    setVariants(prev => [...prev, v]);
  }

  function bulkGenerate() {
    if (!bulkBase || !bulkAttr || !bulkValues) return;
    const vals = bulkValues.split(',').map(v => v.trim()).filter(Boolean);
    const price = parseFloat(bulkPrice) || 0;
    const stock = parseInt(bulkStock) || 0;
    const newVariants: ProductVariant[] = vals.map(val => ({
      id: uuidv4(),
      productId: product?.id ?? '',
      name: `${bulkBase} ${val}`,
      attributes: { [bulkAttr]: val },
      price,
      initialStock: stock,
      currentStock: stock,
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid #2D3048' }}>
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-[#24273A]"
          style={{ background: '#141624' }}>
          <h2 className="text-lg font-bold text-[#E6E7EB]">{product ? 'Edit Product' : 'New Product'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB] hover:bg-[#1B1E2E]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Product Name</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="T-Shirt"
                className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-1.5">Category</label>
              <input value={category} onChange={e => setCategory(e.target.value)}
                placeholder="Apparel"
                className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none transition-colors" />
            </div>
          </div>

          {/* Bulk generator */}
          <div className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(107,92,255,0.06)', border: '1px solid rgba(107,92,255,0.2)' }}>
            <p className="text-xs font-semibold text-[#7C6DFF] uppercase tracking-wider">⚡ Bulk Variant Generator</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={bulkBase} onChange={e => setBulkBase(e.target.value)}
                placeholder="Base name (e.g. T-Shirt Black)"
                className="col-span-2 px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
              <input value={bulkAttr} onChange={e => setBulkAttr(e.target.value)}
                placeholder="Attribute (e.g. size)"
                className="px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
              <input value={bulkValues} onChange={e => setBulkValues(e.target.value)}
                placeholder="Values (e.g. M, L, XL)"
                className="px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#1B1E2E] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none" />
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

        <div className="sticky bottom-0 flex gap-2 p-4 border-t border-[#24273A]" style={{ background: '#141624' }}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5] hover:text-[#E6E7EB] transition-colors"
            style={{ border: '1px solid #2D3048' }}>
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
            Save Product
          </button>
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid #2D3048' }}>
        <div className="flex items-center justify-between p-4 border-b border-[#24273A]">
          <h2 className="text-lg font-bold text-[#E6E7EB]">New Show</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB]"><X size={18} /></button>
        </div>
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
        <div className="flex gap-2 p-4 border-t border-[#24273A]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]" style={{ border: '1px solid #2D3048' }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">Save Show</button>
        </div>
      </div>
    </div>
  );
}

// ── Start Sale Modal ───────────────────────────────────────────────────────

function StartSaleModal({ showId, onStart, onClose }: { showId: string; onStart: (repName: string, stand?: string) => void; onClose: () => void }) {
  const { state } = useMerchPad();
  const [repName, setRepName] = useState(state.repName);
  const [stand, setStand] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(14,15,20,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl animate-slide-up"
        style={{ background: '#141624', border: '1px solid #2D3048' }}>
        <div className="flex items-center justify-between p-4 border-b border-[#24273A]">
          <h2 className="text-lg font-bold text-[#E6E7EB]">Start Sale Session</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7B7F93] hover:text-[#E6E7EB]"><X size={18} /></button>
        </div>
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
        <div className="flex gap-2 p-4 border-t border-[#24273A]">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]" style={{ border: '1px solid #2D3048' }}>Cancel</button>
          <button onClick={() => { if (!repName.trim()) { toast.error('Name required'); return; } onStart(repName.trim(), stand.trim() || undefined); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary flex items-center justify-center gap-2">
            <Zap size={14} /> Start Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export default function MerchOffice() {
  const [, navigate] = useLocation();
  const { state, saveProduct, deleteProduct, saveShow, startSession } = useMerchPad();
  const { products, shows, activeSession, isLoading } = state;

  const [selectedShowId, setSelectedShowId] = useState(shows.find(s => s.status === 'upcoming')?.id ?? shows[0]?.id ?? '');
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);
  const [showNewShow, setShowNewShow] = useState(false);
  const [showStartSale, setShowStartSale] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

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
      <div className="relative overflow-hidden px-4 pt-4 pb-6"
        style={{
          background: `linear-gradient(to bottom, rgba(14,15,20,0) 0%, #0E0F14 100%), url(https://d2xsxph8kpxj0f.cloudfront.net/310519663361417877/U3ZSLTmW8mQsvZ2KUYsYhR/merchpad-hero-bg-QTNZkgshAugSQaW8YVe4nh.webp) center/cover no-repeat`,
          minHeight: 160,
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
          <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-2">Show</p>
          <ShowSelector
            shows={shows}
            selectedShowId={selectedShowId}
            onSelect={setSelectedShowId}
            onNewShow={() => setShowNewShow(true)}
          />
        </div>

        {/* Start Sale CTA */}
        {!activeSession ? (
          <button
            onClick={() => { if (!selectedShowId) { toast.error('Select a show first'); return; } setShowStartSale(true); }}
            className="w-full py-4 rounded-2xl text-base font-black text-white mp-btn-primary flex items-center justify-center gap-2"
            style={{ boxShadow: '0 0 24px rgba(107,92,255,0.3)' }}>
            <Zap size={18} />
            Start Sale Session
          </button>
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
            <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider">Products</p>
            <button onClick={() => setEditingProduct('new')}
              className="flex items-center gap-1 text-xs font-semibold text-[#7C6DFF] hover:text-[#6B5CFF] transition-colors">
              <Plus size={13} /> Add Product
            </button>
          </div>

          <div className="space-y-2">
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
                      {product.variants.map(v => (
                        <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: 'rgba(14,15,20,0.4)' }}>
                          <span className="text-sm text-[#A4A7B5]">{v.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-[#7B7F93] mp-mono">{formatCurrency(v.price)}</span>
                            <span className={cn('text-sm font-bold mp-mono',
                              v.currentStock <= 0 ? 'text-[#F87171]' :
                              v.currentStock / (v.initialStock || 1) <= 0.1 ? 'text-[#F87171]' :
                              v.currentStock / (v.initialStock || 1) <= 0.3 ? 'text-[#FBBF24]' :
                              'text-[#4ADE80]')}>
                              {v.currentStock}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 p-3 pt-0">
                      <button onClick={() => setEditingProduct(product)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[#A4A7B5] hover:text-[#E6E7EB] transition-colors"
                        style={{ border: '1px solid #2D3048' }}>
                        <Edit2 size={12} /> Edit
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
          </div>
        </div>

        {/* Past shows summary */}
        {shows.filter(s => s.status === 'completed').length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#7B7F93] uppercase tracking-wider mb-2">Past Shows</p>
            <div className="space-y-2">
              {shows.filter(s => s.status === 'completed').map(s => (
                <div key={s.id} className="mp-card p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#E6E7EB]">{s.name}</p>
                    <p className="text-xs text-[#7B7F93]">{s.venue} · {formatDate(s.date)}</p>
                  </div>
                  <TrendingUp size={16} className="text-[#7B7F93]" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Modals */}
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
    </div>
  );
}
