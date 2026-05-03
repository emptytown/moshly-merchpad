/**
 * Merch Office — pre-show preparation screen
 * Design: "Neon Ledger" — dark glass cards, Moshly accent colors
 * Features: items editor, show selector, stats summary, past registers
 */

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, Play, ChevronDown, ChevronUp, Package, Calendar, TrendingUp, X, Check, Zap, BookOpen, Sparkles, AlertCircle, ArrowRightLeft, Warehouse, Truck, Sliders, Phone, Mail, UserCheck, UserX, ShoppingBag, Clock, DollarSign, Info, Pencil, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { Product, ProductVariant, Show, TeamMember, getDB } from '../lib/db';
import { cn } from '../lib/utils';
import { loadCatalogue, CatalogueTemplate } from '../lib/catalogue';
import StockTransferModal from '../components/StockTransferModal';
import { AdjustmentModal } from './DetailInfo';
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

// ── Product Editor Modal ───────────────────────────────────────────────────

interface ProductEditorProps {
  product?: Product;
  onSave: (p: Product) => void;
  onClose: () => void;
}

function ProductEditor({ product, onSave, onClose }: ProductEditorProps) {
  const { state } = useMerchPad();
  const { settings } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [quickPrice, setQuickPrice] = useState(product?.variants.length === 1 && !Object.keys(product.variants[0].attributes).length ? String(product.variants[0].price) : '');
  const [quickStock, setQuickStock] = useState(product?.variants.length === 1 && !Object.keys(product.variants[0].attributes).length ? String(product.variants[0].currentStock) : '');
  const [bulkBase, setBulkBase] = useState('');
  const [bulkAttr, setBulkAttr] = useState('');
  const [bulkValues, setBulkValues] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSuspensionConfirm, setShowSuspensionConfirm] = useState(false);
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [showBulkNote, setShowBulkNote] = useState(() => {
    return localStorage.getItem('mp_hide_bulk_note') !== 'true';
  });

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
    const isWarehouse = settings.defaultStockLocation === 'warehouse';
    const newVariants: ProductVariant[] = vals.map(val => ({
      id: uuidv4(),
      productId: product?.id ?? '',
      name: `${bulkBase} ${val}`,
      attributes: { [bulkAttr.trim().toLowerCase()]: val },
      price,
      initialStock: stock,
      currentStock: isWarehouse ? 0 : stock,
      warehouseStock: isWarehouse ? stock : 0,
      roadStock: isWarehouse ? 0 : stock,
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
    
    // If it's a suspended product and we haven't shown the confirm yet, show it
    if (product?.status === 'suspended' && !showSuspensionConfirm) {
      setShowSuspensionConfirm(true);
      return;
    }

    performSave(product?.status);
  }

  function performSave(forcedStatus?: 'active' | 'suspended') {
    const pid = product?.id ?? uuidv4();
    let finalVariants = [...variants];

    // If no variants but quick price/stock provided, create a default variant
    if (finalVariants.length === 0 && (quickPrice || quickStock)) {
      const price = parseFloat(quickPrice) || 0;
      const stock = parseInt(quickStock) || 0;
      const isWarehouse = settings.defaultStockLocation === 'warehouse';
      finalVariants = [{
        id: uuidv4(),
        productId: pid,
        name: name.trim(),
        attributes: {},
        price,
        initialStock: stock,
        currentStock: isWarehouse ? 0 : stock,
        warehouseStock: isWarehouse ? stock : 0,
        roadStock: isWarehouse ? 0 : stock,
      }];
    }

    const now = new Date().toISOString();
    const p: Product = {
      id: pid,
      projectId: product?.projectId ?? state.projectId,
      name: name.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      variants: finalVariants.map(v => ({ ...v, productId: pid })),
      createdAt: product?.createdAt ?? now,
      updatedAt: now,
      status: forcedStatus ?? product?.status ?? 'active',
    };
    onSave(p);
  }

  return (
    <RightDrawer open={true} onClose={onClose} title={product ? 'Edit Product' : 'New Product'} className="max-w-md">

        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Catalogue template picker */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--primary)', background: 'var(--primary)/5' }}>
            <button onClick={() => setShowCatPicker(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-primary" />
                <span className="text-xs font-semibold text-primary">Pick from Item Template Creator</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{showCatPicker ? 'Hide' : `${catalogue.length} templates`}</span>
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
                    <span className="text-xs font-bold text-[#7B7F93]">{formatCurrency(t.defaultPrice, currency)}</span>
                  </button>
                ))}
                {catalogue.length === 0 && (
                  <p className="text-xs text-[#7B7F93] py-2 text-center">No templates yet — add them in Settings → Item Template Creator</p>
                )}
              </div>
            )}
          </div>

          {/* Basic info */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Product Name</label>
                <input value={name} onFocus={e => e.target.value = ''} onChange={e => checkName(e.target.value)}
                  placeholder="T-Shirt"
                  list="catalogue-name-suggestions"
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border focus:outline-none transition-colors',
                    nameWarning ? 'border-orange-500 focus:border-orange-500' : 'border-border focus:border-primary'
                  )} />
                <datalist id="catalogue-name-suggestions">
                  {catalogueNames.map(n => <option key={n} value={n} />)}
                </datalist>
                {nameWarning && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <AlertCircle size={11} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-orange-500">{nameWarning}</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Category</label>
                <input value={category} onFocus={e => e.target.value = ''} onChange={e => setCategory(e.target.value)}
                  placeholder="Apparel"
                  list="catalogue-category-suggestions"
                  className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors" />
                <datalist id="catalogue-category-suggestions">
                  {catalogueCategories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Product details..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors resize-none" />
            </div>

            {variants.length === 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Price ({symbol})</label>
                  <input value={quickPrice} onChange={e => setQuickPrice(e.target.value)}
                    placeholder="0.00" type="number" step="0.01"
                    className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Initial Stock ({settings.defaultStockLocation === 'warehouse' ? 'WH' : 'Road'})</label>
                  <input value={quickStock} onChange={e => setQuickStock(e.target.value)}
                    placeholder="0" type="number"
                    className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors" />
                </div>
              </div>
            )}
          </div>

          {/* Bulk generator */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setIsBulkOpen(!isBulkOpen)}
              className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">⚡ Bulk Variant Generator</p>
                <div className="group relative">
                  <Info size={14} className="text-primary/60 cursor-help" />
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 rounded-lg bg-popover border border-border shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60]">
                    <p className="text-[11px] leading-relaxed text-foreground">
                      Generate multiple variants at once by specifying an attribute (like Size or Color) and its values (separated by commas).
                    </p>
                  </div>
                </div>
              </div>
              {isBulkOpen ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-primary" />}
            </button>

            {isBulkOpen && (
              <div className="p-3 pt-0 space-y-3">
                {showBulkNote && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 flex flex-col gap-2">
                    <p className="text-[11px] text-primary/80 leading-snug">
                      <strong>Pro tip:</strong> You can quickly create all your sizes or colors here. Just enter "Size" and "S, M, L, XL" to generate 4 variants instantly.
                    </p>
                    <label className="flex items-center gap-1.5 cursor-pointer self-end">
                      <input
                        type="checkbox"
                        className="w-3 h-3 rounded border-primary/30 text-primary focus:ring-0 focus:ring-offset-0 bg-transparent"
                        onChange={(e) => {
                          if (e.target.checked) {
                            localStorage.setItem('mp_hide_bulk_note', 'true');
                            setShowBulkNote(false);
                          }
                        }}
                      />
                      <span className="text-[9px] font-medium text-primary/60 uppercase tracking-tighter">Never show again</span>
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input value={bulkBase} onChange={e => setBulkBase(e.target.value)}
                    placeholder="Base name (e.g. T-Shirt Black)"
                    className="col-span-2 px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
                  <div className="relative">
                    <input value={bulkAttr} onFocus={e => e.target.value = ''} onChange={e => setBulkAttr(e.target.value)}
                      placeholder="Attribute (e.g. size)"
                      list="bulk-attr-suggestions"
                      className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
                    <datalist id="bulk-attr-suggestions">
                      {Array.from(new Set(catalogue.flatMap(t => t.variantAxes.map(a => a.key)))).map(k => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                  </div>
                  <div className="relative">
                    <input value={bulkValues} onChange={e => setBulkValues(e.target.value)}
                      placeholder="Values (e.g. M, L, XL)"
                      className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
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
                              style={{ background: 'var(--primary)/10', color: 'var(--primary)', border: '1px solid var(--primary)/20' }}>
                              + {v}
                            </button>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-tighter">Price</label>
                    <input value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                      placeholder={`Price (${currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'})`}
                      type="number" min="0" step="1"
                      className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-tighter">Initial stock ({settings.defaultStockLocation === 'warehouse' ? 'WH' : 'Road'})</label>
                    <input value={bulkStock} onChange={e => setBulkStock(e.target.value)}
                      placeholder="Initial stock"
                      type="number" min="0"
                      className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
                  </div>
                </div>
                <button onClick={bulkGenerate}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                  style={{ border: '1px solid var(--border)' }}>
                  Generate Variants
                </button>
              </div>
            )}
          </div>

          {/* Variants list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variants ({variants.length})</p>
              <button onClick={addVariant} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 text-[10px] font-bold text-[#7B7F93] uppercase tracking-wider">
                <span className="flex-1">Name</span>
                <span className="w-16 text-right">Price</span>
                <span className="w-16 text-right">Stock</span>
                <span className="w-6"></span>
              </div>
              {variants.map(v => (
                <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                  <input value={v.name} onFocus={e => e.target.value = ''} onChange={e => updateVariant(v.id, 'name', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 rounded text-sm text-foreground bg-transparent focus:outline-none" />
                  <div className="relative w-16">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold pointer-events-none">
                      {currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€'}
                    </span>
                    <input value={v.price} onChange={e => updateVariant(v.id, 'price', parseFloat(e.target.value) || 0)}
                      type="number" min="0" step="1"
                      className="w-full pl-5 pr-2 py-1 rounded text-sm text-foreground bg-background border border-border focus:outline-none text-right" />
                  </div>
                  <input value={v.currentStock} onChange={e => { const n = parseInt(e.target.value) || 0; const isWH = settings.defaultStockLocation === 'warehouse'; updateVariant(v.id, 'currentStock', n); updateVariant(v.id, 'initialStock', n); updateVariant(v.id, 'warehouseStock', isWH ? n : 0); updateVariant(v.id, 'roadStock', isWH ? 0 : n); }}
                    type="number" min="0" placeholder="Stock"
                    className="w-16 px-2 py-1 rounded text-sm text-foreground bg-background border border-border focus:outline-none text-right" />
                  <button onClick={() => removeVariant(v.id)} className="text-[#7B7F93] hover:text-[#F87171] p-1 flex-shrink-0">
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

      <div className="flex flex-col gap-2 p-4 border-t border-border flex-shrink-0">
        {showSuspensionConfirm && (
          <div className="mb-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <p className="text-xs font-semibold text-orange-500 mb-2 text-center">
              This product is currently suspended
            </p>
            <div className="flex gap-2">
              <button onClick={() => performSave('active')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                Activate
              </button>
              <button onClick={() => performSave('suspended')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-orange-500/50 text-orange-500 hover:bg-orange-500/10 transition-colors">
                Keep Suspended
              </button>
              <button onClick={onClose}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-border text-muted-foreground hover:text-foreground transition-colors">
                Cancel Edit
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary">
            Save Product
          </button>
        </div>
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
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-primary" />
          {selected ? (
            <div>
              <p className="text-sm font-semibold text-foreground">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.venue} · {formatDate(selected.date)}</p>
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
          {shows.map(s => (
            <button key={s.id} onClick={() => { onSelect(s.id); setOpen(false); }}
              className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/10 transition-colors',
                s.id === selectedShowId && 'bg-primary/10')}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.venue} · {formatDate(s.date)}</p>
              </div>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                s.status === 'upcoming' ? 'text-green-500 bg-green-500/10' :
                s.status === 'active' ? 'text-primary bg-primary/10' :
                'text-muted-foreground bg-muted')}>
                {s.status}
              </span>
            </button>
          ))}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
      <div className="flex gap-2 p-4 border-t border-border flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground" style={{ border: '1px solid var(--border)' }}>Cancel</button>
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <p className="text-sm text-muted-foreground">This will snapshot the current stock for your stand. Stock stroke colors will reflect this allocation.</p>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Your Name</label>
          <input value={repName} onChange={e => setRepName(e.target.value)} placeholder="João"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Stand / Location (optional)</label>
          <input value={stand} onChange={e => setStand(e.target.value)} placeholder="Stand A"
            className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none" />
        </div>
      </div>
      <div className="flex gap-2 p-4 border-t border-border flex-shrink-0">
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

function PastShowsSection({ shows, symbol, secPastShows, setSecPastShows, expandedPastShow, setExpandedPastShow, pastShowStats, setPastShowStats, onDelete }: PastShowsSectionProps) {
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
  const { state, saveProduct, deleteProduct, saveShow, deleteShow, startSession, startOneOffSession, adjustStock, saveTeamMember, deleteTeamMember, getTeamMemberStats } = useMerchPad();
  const { products, shows, activeSession, isLoading, settings } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';

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
  // Team member drawer
  const [editingMember, setEditingMember] = useState<TeamMember | 'new' | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', email: '', active: true });
  const [memberStats, setMemberStats] = useState<{ shifts: number; hoursWorked: number; totalItems: number; totalRevenue: number } | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<string | null>(null);
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
  const totalStockValue = products.reduce((s, p) => s + p.variants.reduce((vs, v) => vs + v.currentStock * v.price, 0), 0);

  const [allTimeSales, setAllTimeSales] = useState<number | null>(null);
  const [lastGigRevenue, setLastGigRevenue] = useState<number | null>(null);

  useEffect(() => {
    async function loadSalesStats() {
      const db = await getDB();
      const batches = await db.getAll('tallyBatches');
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
  }, [shows]);

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

      <div className="px-4 space-y-6 -mt-2">
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
                      {product.variants.reduce((s, v) => s + v.currentStock, 0)} units
                    </span>
                    {expandedProduct === product.id ? <ChevronUp size={14} className="text-[#7B7F93]" /> : <ChevronDown size={14} className="text-[#7B7F93]" />}
                  </div>
                </button>

                {expandedProduct === product.id && (
                  <div className="border-t border-[#24273A]">
                    <div className={cn("p-3 space-y-1.5", product.status === 'suspended' && "opacity-50 grayscale-[0.5]")}>
                      {/* Column headers */}
                      <div className="flex items-center justify-between px-2 pb-1">
                        <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">Variant</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider w-12 text-right">Price</span>
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider w-8 text-right">WH</span>
                          <span className="text-[10px] font-semibold text-green-500 uppercase tracking-wider w-8 text-right">Road</span>
                        </div>
                      </div>
                      {product.variants.map(v => (
                        <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: 'var(--background)', border: '2px solid var(--border)' }}>
                          <span className="text-sm text-muted-foreground">{v.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground mp-mono w-12 text-right">{formatCurrency(v.price, currency)}</span>
                            <span className="text-sm font-bold mp-mono text-primary w-8 text-right">{v.warehouseStock ?? 0}</span>
                            <span className={cn('text-sm font-bold mp-mono w-8 text-right',
                              (v.roadStock ?? v.currentStock) <= 0 ? 'text-destructive' :
                              (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.1 ? 'text-destructive' :
                              (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.3 ? 'text-orange-500' :
                              'text-green-500')}>
                              {v.roadStock ?? v.currentStock}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Two-tier stock summary */}
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
                    <div className="flex gap-2 p-3 pt-0">
                      <button onClick={() => setEditingProduct(product)}
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
                        <button onClick={async () => {
                          if (confirm(`Suspend product, are you sure?`)) {
                            const updated = { ...product, status: 'suspended' as const, updatedAt: new Date().toISOString() };
                            await saveProduct(updated);
                            toast.success(`${product.name} suspended`);
                          }
                        }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-orange-500 hover:bg-orange-500/10 transition-colors"
                          style={{ border: '1px solid var(--border)' }}>
                          <UserX size={12} /> Suspend
                        </button>
                      )}
                      <button onClick={() => { if (confirm(`Delete ${product.name}?`)) deleteProduct(product.id); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                        style={{ border: '1px solid var(--border)' }}>
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

        {/* Stock Management */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSecStock(v => !v)} className="flex items-center gap-1.5 group">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Management</p>
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
                        className={cn("flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer", product.status === 'suspended' && "opacity-50 grayscale-[0.5]")}
                      >
                        <span className="text-[#7B7F93] flex-shrink-0">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                            {product.status === 'suspended' && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-tight whitespace-nowrap">
                                <UserX size={8} /> Suspended
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#7B7F93]">{product.variants.length} variants</p>
                        </div>
                    {!isExpanded && (
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs font-bold mp-mono text-primary">{totalWH} WH</span>
                        <span className="text-xs font-bold mp-mono text-green-500">{totalRoad} Road</span>
                      </div>
                    )}
                      </div>
                      <button
                        onClick={() => setTransferProduct(product)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-primary hover:text-primary/80 transition-colors flex-shrink-0 ml-2"
                        style={{ border: '1px solid var(--border)' }}>
                        <ArrowRightLeft size={11} /> Transfer
                      </button>
                    </div>
                    {isExpanded && (
                      <div className={cn("border-t border-[#24273A] p-3 space-y-1.5", product.status === 'suspended' && "opacity-50 grayscale-[0.5]")}>
                        <div className="flex items-center justify-between px-2 pb-1">
                          <span className="text-[10px] font-semibold text-[#7B7F93] uppercase tracking-wider">Variant</span>
                          <div className="flex items-center gap-3">
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider w-8 text-right">WH</span>
                          <span className="text-[10px] font-semibold text-green-500 uppercase tracking-wider w-8 text-right">Road</span>
                          <span className="text-[10px] font-semibold text-primary uppercase tracking-wider text-right">Adjust</span>
                          </div>
                        </div>
                        {product.variants.map(v => (
                        <div key={v.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                          style={{ background: 'var(--background)', border: '2px solid var(--border)' }}>
                          <span className="text-sm text-muted-foreground">{v.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold mp-mono text-primary w-8 text-right">{v.warehouseStock ?? 0}</span>
                            <span className={`text-sm font-bold mp-mono w-8 text-right ${
                              (v.roadStock ?? v.currentStock) <= 0 ? 'text-destructive' :
                              (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.1 ? 'text-destructive' :
                              (v.roadStock ?? v.currentStock) / (v.initialStock || 1) <= 0.3 ? 'text-orange-500' :
                              'text-green-500'}`}>
                              {v.roadStock ?? v.currentStock}
                            </span>
                            <button
                              onClick={() => setAdjustingVariant({ variantId: v.id, productId: product.id, variantName: v.name, currentStock: v.currentStock })}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                              style={{ background: 'rgba(107,92,255,0.1)', border: '1px solid rgba(107,92,255,0.2)' }}>
                              <Sliders size={11} /> Adjust
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

      {/* Member Drawer */}
      {editingMember !== null && (
        <RightDrawer
          open={true}
          onClose={() => setEditingMember(null)}
          title={editingMember === 'new' ? 'New Team Member' : 'Edit Member'}
          subtitle={editingMember !== 'new' ? editingMember.name : 'Fill in the details below'}
        >
          <div className="flex-1 overflow-y-auto">
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

          <div className="flex gap-2 p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
            <div className="mp-card p-5 max-w-xs w-full space-y-3 animate-in zoom-in-95 duration-200">
              <p className="text-sm font-bold text-foreground uppercase tracking-tight">Remove {m?.name}?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">This only removes the team member record. Historical sales data is preserved.</p>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setConfirmDeleteMember(null)} className="flex-1 py-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors" style={{ border: '1px solid var(--border)' }}>Cancel</button>
                <button onClick={async () => {
                  await deleteTeamMember(confirmDeleteMember);
                  toast.success('Team member removed');
                  setConfirmDeleteMember(null);
                  setEditingMember(null);
                }} className="flex-1 py-2 rounded-lg text-sm font-bold text-white bg-destructive/20 hover:bg-destructive/30 border border-destructive/40 transition-colors">Remove</button>
              </div>
            </div>
          </div>
        );
      })()}

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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
