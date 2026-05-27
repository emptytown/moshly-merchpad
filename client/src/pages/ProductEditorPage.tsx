/**
 * ProductEditorPage — full-page version of the ProductEditor drawer
 * Routes: /new-product  |  /edit-product?id=<productId>
 */

import { useState, useMemo, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, X, BookOpen, Info, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
import { Product, ProductVariant } from '../lib/db';
import { cn } from '../lib/utils';
import { loadCatalogue, CatalogueTemplate } from '../lib/catalogue';

function formatCurrency(n: number, currency = 'EUR') {
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  return `${symbol}${n.toFixed(2)}`;
}

// ── Category Picker ────────────────────────────────────────────────────────

interface CategoryPickerProps {
  value: string;
  onChange: (category: string) => void;
  availableCategories: string[];
}

function CategoryPicker({ value, onChange, availableCategories }: CategoryPickerProps) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');

  function handlePillSelect(cat: string) {
    onChange(cat === value ? '' : cat);
    setIsAddingCustom(false);
  }

  function handleCustomConfirm() {
    const trimmed = customInput.trim();
    if (trimmed) onChange(trimmed);
    setIsAddingCustom(false);
    setCustomInput('');
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        Category
      </label>
      <div className="flex flex-wrap gap-1.5">
        {availableCategories.map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => handlePillSelect(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              value === cat
                ? 'text-white'
                : 'text-muted-foreground hover:text-foreground'
            )}
            style={value === cat
              ? { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)', border: '1px solid transparent' }
              : { background: 'var(--muted)', border: '1px solid var(--border)' }
            }
          >
            {cat}
          </button>
        ))}

        {/* Custom category input */}
        {isAddingCustom ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCustomConfirm();
                if (e.key === 'Escape') { setIsAddingCustom(false); setCustomInput(''); }
              }}
              placeholder="New category…"
              className="px-3 py-1.5 rounded-full text-xs text-foreground bg-background border border-primary focus:outline-none w-32"
            />
            <button
              type="button"
              onClick={handleCustomConfirm}
              className="px-2 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setIsAddingCustom(false); setCustomInput(''); }}
              className="px-2 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
              style={{ border: '1px solid var(--border)' }}
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingCustom(true)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            style={{ border: '1px dashed rgba(107,92,255,0.4)', background: 'rgba(107,92,255,0.05)' }}
          >
            + New
          </button>
        )}
      </div>

      {/* Show selected value if it's a custom one not in the pill list */}
      {value && !availableCategories.includes(value) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-xs text-muted-foreground">Custom:</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }}
          >
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProductEditorPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const productId = new URLSearchParams(search).get('id');

  const { state, saveProduct } = useMerchPad();
  const { activeProject } = useProjects();
  const { settings, products } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';

  const product = productId ? products.find(p => p.id === productId) : undefined;

  useEffect(() => {
    if (productId && !state.isLoading && !product) {
      navigate('/');
    }
  }, [productId, product, state.isLoading, navigate]);

  const [name, setName] = useState(product?.name ?? '');
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [quickPrice, setQuickPrice] = useState(
    product?.variants.length === 1 && !Object.keys(product.variants[0].attributes).length
      ? String(product.variants[0].price)
      : ''
  );
  const [quickStock, setQuickStock] = useState(
    product?.variants.length === 1 && !Object.keys(product.variants[0].attributes).length
      ? String(product.variants[0].currentStock)
      : ''
  );
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

  const catalogue = useMemo(() => loadCatalogue(), []);
  const catalogueNames = useMemo(() => catalogue.map(t => t.name), [catalogue]);

  /** Categories from catalogue templates + already-used categories in this project */
  const availableCategories = useMemo(() => {
    const fromCatalogue = catalogue.map(t => t.category);
    const fromProducts = products.map(p => p.category).filter((c): c is string => Boolean(c));
    return Array.from(new Set([...fromCatalogue, ...fromProducts])).sort();
  }, [catalogue, products]);

  const MIN_NAME_LENGTH_FOR_FUZZY_WARNING = 4;

  function checkName(val: string) {
    setName(val);
    const trimmed = val.trim();
    if (trimmed.length < MIN_NAME_LENGTH_FOR_FUZZY_WARNING) { setNameWarning(null); return; }
    const lower = trimmed.toLowerCase();
    const similarName = catalogueNames.find(n => {
      const nl = n.toLowerCase();
      if (nl === lower) return false;
      if (nl.startsWith(lower) || lower.startsWith(nl)) return true;
      let diff = 0;
      const maxLen = Math.max(nl.length, lower.length);
      for (let i = 0; i < maxLen; i++) { if (nl[i] !== lower[i]) diff++; }
      return diff <= 2 && maxLen > 3;
    });
    setNameWarning(similarName ? `Did you mean "${similarName}"? Check the catalogue to avoid duplicates.` : null);
  }

  function applyTemplate(t: CatalogueTemplate) {
    setName(t.name);
    setCategory(t.category);
    setNameWarning(null);
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
    if (product?.status === 'suspended' && !showSuspensionConfirm) {
      setShowSuspensionConfirm(true);
      return;
    }
    performSave(product?.status);
  }

  async function performSave(forcedStatus?: 'active' | 'suspended') {
    const pid = product?.id ?? uuidv4();
    let finalVariants = [...variants];

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
      projectId: product?.projectId ?? activeProject?.id ?? '',
      name: name.trim(),
      description: description.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      category: category.trim() || undefined,
      variants: finalVariants.map(v => ({ ...v, productId: pid })),
      createdAt: product?.createdAt ?? now,
      updatedAt: now,
      status: forcedStatus ?? product?.status ?? 'active',
    };

    await saveProduct(p);
    toast.success(`${p.name} saved`);
    navigate('/');
  }

  return (
    <div className="h-full flex flex-col bg-background">

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 z-10"
        style={{ background: 'var(--background)' }}
      >
        <h1 className="text-base font-bold text-foreground">
          {product ? 'Edit Product' : 'New Product'}
        </h1>
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">

        {/* Catalogue template picker */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--primary)', background: 'var(--primary)/5' }}
        >
          <button
            onClick={() => setShowCatPicker(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Pick from Item Template Creator</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {showCatPicker ? 'Hide' : `${catalogue.length} templates`}
            </span>
          </button>
          {showCatPicker && (
            <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
              {catalogue.map(t => (
                <button
                  key={t.id}
                  onClick={() => { applyTemplate(t); setShowCatPicker(false); }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-[rgba(0,229,255,0.08)]"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#E6E7EB]">{t.name}</p>
                    <p className="text-[10px] text-[#7B7F93]">
                      {t.category} · {t.variantAxes.map(a => a.key).join(', ') || 'no axes'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#7B7F93]">
                    {formatCurrency(t.defaultPrice, currency)}
                  </span>
                </button>
              ))}
              {catalogue.length === 0 && (
                <p className="text-xs text-[#7B7F93] py-2 text-center">
                  No templates yet — add them in Settings → Item Template Creator
                </p>
              )}
            </div>
          )}
        </div>

        {/* Basic info */}
        <div className="space-y-3">
          {/* Display Name — full width, no onFocus clear */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              value={name}
              onChange={e => checkName(e.target.value)}
              placeholder="T-Shirt"
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border focus:outline-none transition-colors',
                nameWarning
                  ? 'border-orange-500 focus:border-orange-500'
                  : 'border-border focus:border-primary'
              )}
            />
            {nameWarning && (
              <div className="flex items-start gap-1.5 mt-1.5">
                <AlertCircle size={11} className="text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-orange-500">{nameWarning}</p>
              </div>
            )}
          </div>

          {/* Display Subtitle — optional second line shown on TallyCard */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Display Subtitle <span className="normal-case font-normal text-muted-foreground/60">(optional · shown on Tally card)</span>
            </label>
            <input
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="e.g. Acoustic Edition · Limited Run"
              className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors"
            />
          </div>

          {/* Category — pill selector */}
          <CategoryPicker
            value={category}
            onChange={setCategory}
            availableCategories={availableCategories}
          />

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Product details..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors resize-none"
            />
          </div>

          {variants.length === 0 && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Price ({symbol})
                </label>
                <input
                  value={quickPrice}
                  onChange={e => setQuickPrice(e.target.value)}
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Initial Stock ({settings.defaultStockLocation === 'warehouse' ? 'WH' : 'Road'})
                </label>
                <input
                  value={quickStock}
                  onChange={e => setQuickStock(e.target.value)}
                  placeholder="0"
                  type="number"
                  className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bulk variant generator */}
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
            {isBulkOpen
              ? <ChevronUp size={16} className="text-primary" />
              : <ChevronDown size={16} className="text-primary" />}
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
                      onChange={e => {
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
                <input
                  value={bulkBase}
                  onChange={e => setBulkBase(e.target.value)}
                  placeholder="Base name (e.g. T-Shirt Black)"
                  className="col-span-2 px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none"
                />
                <div className="relative">
                  <input
                    value={bulkAttr}
                    onChange={e => setBulkAttr(e.target.value)}
                    placeholder="Attribute (e.g. size)"
                    list="bulk-attr-suggestions"
                    className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none"
                  />
                  <datalist id="bulk-attr-suggestions">
                    {Array.from(new Set(catalogue.flatMap(t => t.variantAxes.map(a => a.key)))).map(k => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>
                <div className="relative">
                  <input
                    value={bulkValues}
                    onChange={e => setBulkValues(e.target.value)}
                    placeholder="Values (e.g. M, L, XL)"
                    className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none"
                  />
                  {bulkAttr && (() => {
                    const axisKey = bulkAttr.trim().toLowerCase();
                    const suggested = Array.from(new Set(
                      catalogue.flatMap(t =>
                        t.variantAxes.filter(a => a.key === axisKey).flatMap(a => a.values)
                      )
                    ));
                    return suggested.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {suggested.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setBulkValues(prev => prev ? `${prev}, ${v}` : v)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors"
                            style={{ background: 'var(--primary)/10', color: 'var(--primary)', border: '1px solid var(--primary)/20' }}
                          >
                            + {v}
                          </button>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-tighter">Price</label>
                  <input
                    value={bulkPrice}
                    onChange={e => setBulkPrice(e.target.value)}
                    placeholder={`Price (${symbol})`}
                    type="number"
                    min="0"
                    step="1"
                    className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-tighter">
                    Initial stock ({settings.defaultStockLocation === 'warehouse' ? 'WH' : 'Road'})
                  </label>
                  <input
                    value={bulkStock}
                    onChange={e => setBulkStock(e.target.value)}
                    placeholder="Initial stock"
                    type="number"
                    min="0"
                    className="w-full px-3 py-2 rounded-lg text-sm text-foreground bg-background border border-border focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={bulkGenerate}
                className="w-full py-2 rounded-lg text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                style={{ border: '1px solid var(--border)' }}
              >
                Generate Variants
              </button>
            </div>
          )}
        </div>

        {/* Variants list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Variants ({variants.length})
            </p>
            <button onClick={addVariant} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 text-[10px] font-bold text-[#7B7F93] uppercase tracking-wider">
              <span className="flex-1">Name</span>
              <span className="w-16 text-right">Price</span>
              <span className="w-16 text-right">Stock</span>
              <span className="w-6" />
            </div>
            {variants.map(v => (
              <div
                key={v.id}
                className="flex items-center gap-2 p-2 rounded-lg"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <input
                  value={v.name}
                  onChange={e => updateVariant(v.id, 'name', e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded text-sm text-foreground bg-transparent focus:outline-none"
                />
                <div className="relative w-16">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold pointer-events-none">
                    {symbol}
                  </span>
                  <input
                    value={v.price}
                    onChange={e => updateVariant(v.id, 'price', parseFloat(e.target.value) || 0)}
                    type="number"
                    min="0"
                    step="1"
                    className="w-full pl-5 pr-2 py-1 rounded text-sm text-foreground bg-background border border-border focus:outline-none text-right"
                  />
                </div>
                <input
                  value={v.currentStock}
                  onChange={e => {
                    const n = parseInt(e.target.value) || 0;
                    const isWH = settings.defaultStockLocation === 'warehouse';
                    updateVariant(v.id, 'currentStock', n);
                    updateVariant(v.id, 'initialStock', n);
                    updateVariant(v.id, 'warehouseStock', isWH ? n : 0);
                    updateVariant(v.id, 'roadStock', isWH ? 0 : n);
                  }}
                  type="number"
                  min="0"
                  placeholder="Stock"
                  className="w-16 px-2 py-1 rounded text-sm text-foreground bg-background border border-border focus:outline-none text-right"
                />
                <button
                  onClick={() => removeVariant(v.id)}
                  className="text-[#7B7F93] hover:text-[#F87171] p-1 flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {variants.length === 0 && (
              <p className="text-sm text-[#7B7F93] text-center py-4">
                No variants yet. Use the bulk generator or add manually.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex flex-col gap-2 p-4 border-t border-border">
        {showSuspensionConfirm && (
          <div className="mb-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <p className="text-xs font-semibold text-orange-500 mb-2 text-center">
              This product is currently suspended
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => performSave('active')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                Activate
              </button>
              <button
                onClick={() => performSave('suspended')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-orange-500/50 text-orange-500 hover:bg-orange-500/10 transition-colors"
              >
                Keep Suspended
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel Edit
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white mp-btn-primary"
          >
            Save Product
          </button>
        </div>
      </div>

    </div>
  );
}
