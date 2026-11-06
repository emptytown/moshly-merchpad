/**
 * ProductEditorPage — full-page version of the ProductEditor drawer
 * Routes: /new-product  |  /edit-product?id=<productId>
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useMerchPad } from '../contexts/MerchPadContext';
import { useProjects } from '../contexts/ProjectContext';
import { Product, ProductVariant, cleanTags, normalizeProduct, projectTags } from '../lib/db';
import { cn } from '../lib/utils';

// ── Tag Picker ─────────────────────────────────────────────────────────────

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Tags already used in this project */
  projectTags: string[];
}

function TagPicker({ value, onChange, projectTags }: TagPickerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [input, setInput] = useState('');

  const selected = new Set(value.map(t => t.toLowerCase()));
  // Project tags + new ones added on this product (not saved yet)
  const shown = cleanTags([...projectTags, ...value]);

  function toggle(tag: string) {
    onChange(selected.has(tag.toLowerCase())
      ? value.filter(t => t.toLowerCase() !== tag.toLowerCase())
      : [...value, tag]);
  }

  function confirmAdd() {
    const t = input.trim();
    if (t) {
      const existing = shown.find(s => s.toLowerCase() === t.toLowerCase());
      if (!existing) onChange([...value, t]);
      else if (!selected.has(existing.toLowerCase())) onChange([...value, existing]);
    }
    setIsAdding(false);
    setInput('');
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {shown.map(tag => {
          const on = selected.has(tag.toLowerCase());
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn('h-9 px-3.5 rounded-full text-sm font-semibold transition-all',
                on ? 'text-white' : 'text-muted-foreground hover:text-foreground')}
              style={on
                ? { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)', border: '1px solid transparent' }
                : { background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              {tag}
            </button>
          );
        })}

        {isAdding ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmAdd();
                if (e.key === 'Escape') { setIsAdding(false); setInput(''); }
              }}
              placeholder="New tag…"
              className="h-9 px-3 rounded-full text-sm text-foreground bg-background border border-primary focus:outline-none w-36"
            />
            <button
              type="button"
              onClick={confirmAdd}
              className="h-9 px-3 rounded-full text-sm font-bold text-white"
              style={{ background: 'var(--primary)' }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setInput(''); }}
              className="h-9 px-2.5 rounded-full text-sm text-muted-foreground hover:text-foreground"
              style={{ border: '1px solid var(--border)' }}
              aria-label="Cancel"
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="h-9 px-3.5 rounded-full text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
            style={{ border: '1px dashed rgba(107,92,255,0.4)', background: 'rgba(107,92,255,0.05)' }}
          >
            + Add Tag
          </button>
        )}
      </div>
    </div>
  );
}

// ── Layout helpers ─────────────────────────────────────────────────────────

const inputCls = 'w-full h-11 px-3 rounded-xl text-[15px] text-foreground bg-background border border-border focus:border-primary focus:outline-none transition-colors';

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-3.5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-muted-foreground mb-1.5">{children}</label>;
}

/** Money / number box with optional currency prefix */
function NumBox({ label, value, onChange, prefix, placeholder = '0', decimal = true }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; placeholder?: string; decimal?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{prefix}</span>
        )}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={e => e.target.select()}
          type="number"
          inputMode={decimal ? 'decimal' : 'numeric'}
          min="0"
          step={decimal ? '0.01' : '1'}
          placeholder={placeholder}
          className={cn(inputCls, 'text-right', prefix && 'pl-7')}
        />
      </div>
    </div>
  );
}

function Margin({ price, cost, symbol }: { price: number; cost?: number; symbol: string }) {
  if (cost === undefined || !(price > 0)) return null;
  const m = price - cost;
  const pct = Math.round((m / price) * 100);
  return (
    <p className={cn('text-xs mt-1.5', m >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]')}>
      Margin {m < 0 ? '−' : ''}{symbol}{Math.abs(m).toFixed(2)} ({pct}%)
    </p>
  );
}

const numStr = (n: number | undefined) => (n === undefined || n === null ? '' : String(n));
const parseMoney = (s: string) => { const n = parseFloat(s); return isNaN(n) || n < 0 ? 0 : n; };
const parseCost = (s: string) => { if (s.trim() === '') return undefined; const n = parseFloat(s); return isNaN(n) || n < 0 ? undefined : n; };
const parseQty = (s: string) => { const n = parseInt(s); return isNaN(n) || n < 0 ? 0 : n; };

/** A variant is "simple" when it is the product's only variant and has no attributes */
function isSimpleProduct(vs: ProductVariant[]) {
  return vs.length <= 1 && (vs.length === 0 || Object.keys(vs[0].attributes).length === 0);
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
  const isWarehouse = settings.defaultStockLocation === 'warehouse';

  const product = productId ? products.find(p => p.id === productId) : undefined;

  useEffect(() => {
    if (productId && !state.isLoading && !product) {
      navigate('/');
    }
  }, [productId, product, state.isLoading, navigate]);

  const [name, setName] = useState(product?.name ?? '');
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [showDescription, setShowDescription] = useState(Boolean(product?.description));
  const [tags, setTags] = useState<string[]>(product ? (normalizeProduct(product).tags ?? []) : []);
  const [variants, setVariants] = useState<ProductVariant[]>(product?.variants ?? []);
  const [hasVariants, setHasVariants] = useState(product ? !isSimpleProduct(product.variants) : false);

  // Opened by URL / after reload: products load after first render — fill the form once they arrive
  const filledFor = useRef<string | null>(product?.id ?? null);
  useEffect(() => {
    if (!product || filledFor.current === product.id) return;
    filledFor.current = product.id;
    setName(product.name);
    setSubtitle(product.subtitle ?? '');
    setDescription(product.description ?? '');
    setShowDescription(Boolean(product.description));
    setTags(normalizeProduct(product).tags ?? []);
    setVariants(product.variants);
    setHasVariants(!isSimpleProduct(product.variants));
  }, [product]);

  // Bulk generator ("Generate several")
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkAttr, setBulkAttr] = useState('');
  const [bulkValues, setBulkValues] = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkCost, setBulkCost] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [showSuspensionConfirm, setShowSuspensionConfirm] = useState(false);

  const availableTags = useMemo(() => projectTags(products), [products]);

  // Raw text of number fields while typing (so "2." or "" are not lost)
  const [draft, setDraft] = useState<Record<string, string>>({});
  const fieldKey = (id: string, f: string) => `${id}:${f}`;
  function fieldValue(v: ProductVariant, f: 'price' | 'unitCost' | 'stock') {
    const k = fieldKey(v.id, f);
    if (k in draft) return draft[k];
    if (f === 'price') return v.price ? String(v.price) : '';
    if (f === 'unitCost') return numStr(v.unitCost);
    return v.currentStock || v.warehouseStock ? String(isWarehouse ? v.warehouseStock : v.currentStock) : '';
  }

  function newVariant(partial: Partial<ProductVariant> = {}): ProductVariant {
    return {
      id: uuidv4(), productId: product?.id ?? '', name: '', attributes: {}, price: 0,
      initialStock: 0, currentStock: 0, warehouseStock: 0, roadStock: 0, ...partial,
    };
  }

  function stockFields(n: number) {
    return {
      initialStock: n,
      currentStock: isWarehouse ? 0 : n,
      warehouseStock: isWarehouse ? n : 0,
      roadStock: isWarehouse ? 0 : n,
    };
  }

  function setField(id: string, f: 'price' | 'unitCost' | 'stock', raw: string) {
    setDraft(d => ({ ...d, [fieldKey(id, f)]: raw }));
    setVariants(prev => prev.map(v => {
      if (v.id !== id) return v;
      if (f === 'price') return { ...v, price: parseMoney(raw) };
      if (f === 'unitCost') return { ...v, unitCost: parseCost(raw) };
      return { ...v, ...stockFields(parseQty(raw)) };
    }));
  }

  // Simple product: edit its single variant in place (keeps its id, so sales history stays linked)
  const simple = variants[0];
  function setSimpleField(f: 'price' | 'unitCost' | 'stock', raw: string) {
    if (simple) { setField(simple.id, f, raw); return; }
    const v = newVariant();
    setDraft(d => ({ ...d, [fieldKey(v.id, f)]: raw }));
    setVariants([f === 'price' ? { ...v, price: parseMoney(raw) }
      : f === 'unitCost' ? { ...v, unitCost: parseCost(raw) }
      : { ...v, ...stockFields(parseQty(raw)) }]);
  }

  function toggleVariants(on: boolean) {
    if (!on && variants.length > 1) {
      toast.error('Remove the extra variants first');
      return;
    }
    if (on && variants.length === 1 && !variants[0].name) {
      setVariants([{ ...variants[0], name: name.trim() }]);
    }
    if (!on && variants.length === 1) {
      setVariants([{ ...variants[0], attributes: {} }]);
    }
    setHasVariants(on);
  }

  function addVariant() {
    setVariants(prev => [...prev, newVariant({ name: name.trim() ? `${name.trim()} ` : '' })]);
  }

  function bulkGenerate() {
    const vals = bulkValues.split(',').map(v => v.trim()).filter(Boolean);
    if (vals.length === 0) { toast.error('Enter the values, separated by commas'); return; }
    const attr = bulkAttr.trim().toLowerCase() || 'option';
    const base = name.trim();
    const created = vals.map(val => newVariant({
      name: base ? `${base} ${val}` : val,
      attributes: { [attr]: val },
      price: parseMoney(bulkPrice),
      unitCost: parseCost(bulkCost),
      ...stockFields(parseQty(bulkStock)),
    }));
    setVariants(prev => [...prev, ...created]);
    setBulkAttr(''); setBulkValues(''); setBulkPrice(''); setBulkCost(''); setBulkStock('');
    setIsBulkOpen(false);
    toast.success(`Added ${created.length} variants`);
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
    const pname = name.trim();
    const finalVariants = hasVariants
      ? variants.map((v, i) => ({ ...v, name: v.name.trim() || `${pname} ${i + 1}` }))
      : variants.slice(0, 1).map(v => ({ ...v, name: pname, attributes: {} }));

    const now = new Date().toISOString();
    const p: Product = {
      id: pid,
      projectId: product?.projectId ?? activeProject?.id ?? '',
      name: pname,
      description: description.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      tags: cleanTags(tags),
      variants: finalVariants.map(v => ({ ...v, productId: pid })),
      createdAt: product?.createdAt ?? now,
      updatedAt: now,
      status: forcedStatus ?? product?.status ?? 'active',
    };

    await saveProduct(p);
    toast.success(`${p.name} saved`);
    navigate('/');
  }

  const stockLabel = `Stock · ${isWarehouse ? 'WH' : 'Road'}`;

  return (
    <div className="h-full flex flex-col bg-background">

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 z-10"
        style={{ background: 'var(--background)' }}
      >
        <h1 className="text-lg font-bold text-foreground">
          {product ? 'Edit Product' : 'New Product'}
        </h1>
        <button
          onClick={() => navigate('/')}
          className="p-2 -mr-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">

        {/* 1 · Product */}
        <Section title="Product">
          <div className="space-y-3">
            <div>
              <FieldLabel>Name</FieldLabel>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="T-Shirt" className={inputCls} />
            </div>
            <div>
              <FieldLabel>Subtitle <span className="text-muted-foreground/60">(optional · shown on Tally)</span></FieldLabel>
              <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. Acoustic Edition" className={inputCls} />
            </div>
            {showDescription ? (
              <div>
                <FieldLabel>Description</FieldLabel>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Product details…"
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-[15px] text-foreground bg-background border border-border focus:border-primary focus:outline-none resize-none"
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowDescription(true)} className="text-sm font-semibold text-primary">
                + Description
              </button>
            )}
          </div>
        </Section>

        {/* 2 · Price & stock */}
        <Section title="Price & stock">
          <button
            type="button"
            role="switch"
            aria-checked={hasVariants}
            onClick={() => toggleVariants(!hasVariants)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-[15px] font-semibold text-foreground">Has variants</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Sizes, colours, formats…</span>
            </span>
            <span
              className="relative w-12 h-7 rounded-full flex-shrink-0 transition-colors"
              style={{ background: hasVariants ? 'var(--primary)' : 'var(--border)' }}
            >
              <span className={cn('absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all', hasVariants ? 'left-[22px]' : 'left-0.5')} />
            </span>
          </button>

          {!hasVariants && (
            <div className="mt-3">
              <div className="grid grid-cols-3 gap-2">
                <NumBox label="Price" prefix={symbol} placeholder="0.00"
                  value={simple ? fieldValue(simple, 'price') : ''} onChange={v => setSimpleField('price', v)} />
                <NumBox label="Cost" prefix={symbol} placeholder="—"
                  value={simple ? fieldValue(simple, 'unitCost') : ''} onChange={v => setSimpleField('unitCost', v)} />
                <NumBox label={stockLabel} decimal={false}
                  value={simple ? fieldValue(simple, 'stock') : ''} onChange={v => setSimpleField('stock', v)} />
              </div>
              {simple && <Margin price={simple.price} cost={simple.unitCost} symbol={symbol} />}
            </div>
          )}
        </Section>

        {/* 3 · Variants */}
        {hasVariants && (
          <Section title={`Variants (${variants.length})`}>
            <div className="space-y-2">
              {variants.map(v => (
                <div key={v.id} className="rounded-xl p-2.5" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={v.name}
                      onChange={e => setVariants(prev => prev.map(x => x.id === v.id ? { ...x, name: e.target.value } : x))}
                      placeholder="Variant name"
                      className="flex-1 min-w-0 h-9 px-1 bg-transparent text-[15px] font-semibold text-foreground focus:outline-none"
                    />
                    <button onClick={() => removeVariant(v.id)} className="p-2 text-muted-foreground hover:text-[#F87171]" aria-label="Remove variant">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <NumBox label="Price" prefix={symbol} placeholder="0.00" value={fieldValue(v, 'price')} onChange={x => setField(v.id, 'price', x)} />
                    <NumBox label="Cost" prefix={symbol} placeholder="—" value={fieldValue(v, 'unitCost')} onChange={x => setField(v.id, 'unitCost', x)} />
                    <NumBox label={stockLabel} decimal={false} value={fieldValue(v, 'stock')} onChange={x => setField(v.id, 'stock', x)} />
                  </div>
                  <Margin price={v.price} cost={v.unitCost} symbol={symbol} />
                </div>
              ))}
              {variants.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">No variants yet.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" onClick={addVariant}
                className="h-11 rounded-xl text-sm font-semibold text-primary flex items-center justify-center gap-1.5"
                style={{ border: '1px dashed rgba(107,92,255,0.5)' }}>
                <Plus size={15} /> Variant
              </button>
              <button type="button" onClick={() => setIsBulkOpen(o => !o)}
                className="h-11 rounded-xl text-sm font-semibold text-primary flex items-center justify-center gap-1.5"
                style={{ border: '1px dashed rgba(107,92,255,0.5)', background: isBulkOpen ? 'rgba(107,92,255,0.1)' : undefined }}>
                <Zap size={15} /> Generate several
              </button>
            </div>

            {isBulkOpen && (
              <div className="mt-3 rounded-xl p-3 space-y-3" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Attribute</FieldLabel>
                    <input value={bulkAttr} onChange={e => setBulkAttr(e.target.value)} placeholder="Size" className={inputCls} />
                  </div>
                  <div>
                    <FieldLabel>Values (comma)</FieldLabel>
                    <input value={bulkValues} onChange={e => setBulkValues(e.target.value)} placeholder="S, M, L, XL" className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumBox label="Price" prefix={symbol} placeholder="0.00" value={bulkPrice} onChange={setBulkPrice} />
                  <NumBox label="Cost" prefix={symbol} placeholder="—" value={bulkCost} onChange={setBulkCost} />
                  <NumBox label={stockLabel} decimal={false} value={bulkStock} onChange={setBulkStock} />
                </div>
                <button type="button" onClick={bulkGenerate} className="w-full h-11 rounded-xl text-sm font-bold text-white mp-btn-primary">
                  Add variants
                </button>
              </div>
            )}
          </Section>
        )}

        {/* 4 · Tags — last; only tags created in this project */}
        <Section title="Tags">
          <TagPicker value={tags} onChange={setTags} projectTags={availableTags} />
        </Section>

      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex flex-col gap-2 px-4 py-3 border-t border-border">
        {showSuspensionConfirm && (
          <div className="mb-1 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
            <p className="text-xs font-semibold text-orange-500 mb-2 text-center">
              This product is currently suspended
            </p>
            <div className="flex gap-2">
              <button onClick={() => performSave('active')}
                className="flex-1 h-9 rounded-lg text-xs font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                Activate
              </button>
              <button onClick={() => performSave('suspended')}
                className="flex-1 h-9 rounded-lg text-xs font-bold border border-orange-500/50 text-orange-500 hover:bg-orange-500/10 transition-colors">
                Keep Suspended
              </button>
              <button onClick={() => navigate('/')}
                className="flex-1 h-9 rounded-lg text-xs font-bold border border-border text-muted-foreground hover:text-foreground transition-colors">
                Cancel Edit
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => navigate('/')}
            className="h-12 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            style={{ border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={handleSave} className="col-span-2 h-12 rounded-xl text-base font-bold text-white mp-btn-primary">
            Save Product
          </button>
        </div>
      </div>

    </div>
  );
}
