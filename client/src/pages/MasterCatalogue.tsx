/**
 * MasterCatalogue — global product template manager
 * Accessible from Settings. Templates are global (not per-project).
 * Each template defines: name, category, variant axes (key + suggested values), default price.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronRight, X, Tag, Layers, BookOpen } from 'lucide-react';
import { useMerchPad } from '../contexts/MerchPadContext';
import {
  CatalogueTemplate, VariantAxis,
  loadCatalogue, addTemplate, updateTemplate, deleteTemplate,
  getAllCategories,
} from '../lib/catalogue';
import { cn } from '../lib/utils';

// ── Axis Editor ────────────────────────────────────────────────────────────

interface AxisEditorProps {
  axes: VariantAxis[];
  onChange: (axes: VariantAxis[]) => void;
}

const COMMON_AXIS_KEYS = ['size', 'colour', 'format', 'edition', 'style', 'finish', 'material', 'type', 'design', 'pack'];

// Uncontrolled per-axis value input — allows free typing of commas/spaces, commits on blur or Enter
function AxisValueInput({ axisKey, initialValues, onCommit }: { axisKey: string; initialValues: string[]; onCommit: (values: string[]) => void }) {
  const [raw, setRaw] = useState(initialValues.join(', '));
  useEffect(() => { setRaw(initialValues.join(', ')); }, [axisKey]);
  function commit() {
    const values = raw.split(',').map(v => v.trim()).filter(Boolean);
    onCommit(values);
  }
  return (
    <input
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      placeholder="e.g. S, M, L, XL"
      className="w-full px-2 py-1.5 rounded-lg text-xs bg-muted border border-border focus:border-primary focus:outline-none"
    />
  );
}

function AxisEditor({ axes, onChange }: AxisEditorProps) {
  const [newKey, setNewKey] = useState('');

  function addAxis() {
    const key = newKey.trim().toLowerCase();
    if (!key) return;
    if (axes.find(a => a.key === key)) { toast.warning(`Axis "${key}" already exists`); return; }
    onChange([...axes, { key, values: [] }]);
    setNewKey('');
  }

  function removeAxis(key: string) {
    onChange(axes.filter(a => a.key !== key));
  }

  function updateAxisValues(key: string, values: string[]) {
    onChange(axes.map(a => a.key === key ? { ...a, values } : a));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Variant Axes</p>

      {axes.map(axis => (
        <div key={axis.key} className="rounded-xl p-3 bg-muted/50 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary capitalize">{axis.key}</span>
            <button onClick={() => removeAxis(axis.key)} className="text-muted-foreground hover:text-destructive transition-colors">
              <X size={12} />
            </button>
          </div>
          <AxisValueInput axisKey={axis.key} initialValues={axis.values} onCommit={vals => updateAxisValues(axis.key, vals)} />
          <p className="text-[10px] text-muted-foreground mt-1">Type values separated by commas (e.g. S, M, L, XL) — press Enter or click away to confirm</p>
        </div>
      ))}

      {/* Add axis */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAxis()}
            placeholder="New axis key (e.g. size)"
            list="axis-key-suggestions"
            className="w-full px-3 py-2 rounded-lg text-xs bg-muted border border-border focus:border-primary focus:outline-none"
          />
          <datalist id="axis-key-suggestions">
            {COMMON_AXIS_KEYS.filter(k => !axes.find(a => a.key === k)).map(k => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <button onClick={addAxis}
          className="px-3 py-2 rounded-lg text-xs font-bold text-primary flex items-center gap-1 bg-primary/10 border border-primary/20">
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

// ── Template Editor ────────────────────────────────────────────────────────

interface TemplateEditorProps {
  initial?: CatalogueTemplate;
  onSave: (t: Omit<CatalogueTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

function TemplateEditor({ initial, onSave, onCancel }: TemplateEditorProps) {
  const { state } = useMerchPad();
  const { settings } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(String(initial?.defaultPrice ?? ''));
  const [axes, setAxes] = useState<VariantAxis[]>(initial?.variantAxes ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [templates, setTemplates] = useState<CatalogueTemplate[]>([]);
  useEffect(() => { setTemplates(loadCatalogue()); }, []);

  const allCategories = getAllCategories(templates);
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);

  function handleSave() {
    const trimmedName = name.trim();
    const trimmedCat = category.trim();
    if (!trimmedName) { toast.error('Template name is required'); return; }
    if (!trimmedCat) { toast.error('Category is required'); return; }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) { toast.error('Enter a valid price'); return; }
    onSave({ name: trimmedName, category: trimmedCat, variantAxes: axes, defaultPrice: parsedPrice, notes: notes.trim() || undefined });
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Product Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. T-Shirt"
          className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border focus:border-primary focus:outline-none"
        />
      </div>

      {/* Category */}
      <div className="relative">
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Category</label>
        <div className="relative">
          <input
            value={category}
            onChange={e => { setCategory(e.target.value); setShowCatSuggestions(true); }}
            onFocus={() => setShowCatSuggestions(true)}
            onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
            placeholder="e.g. Apparel"
            className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border focus:border-primary focus:outline-none"
          />
          {showCatSuggestions && (
            <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-popover border border-border rounded-xl shadow-xl animate-in fade-in slide-in-from-top-1">
              {allCategories
                .filter(c => c.toLowerCase().includes(category.toLowerCase()))
                .map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setCategory(c); setShowCatSuggestions(false); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
                  >
                    {c}
                  </button>
                ))}
              {allCategories.filter(c => c.toLowerCase().includes(category.toLowerCase())).length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground italic">New category will be created</div>
              )}
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Type or pick from suggestions</p>
      </div>

      {/* Default price */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Default Price ({symbol})</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border focus:border-primary focus:outline-none"
        />
      </div>

      {/* Variant axes */}
      <AxisEditor axes={axes} onChange={setAxes} />

      {/* Notes */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about this template..."
          className="w-full px-3 py-2 rounded-lg text-sm bg-muted border border-border focus:border-primary focus:outline-none resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-border">
          Cancel
        </button>
        <button onClick={handleSave}
          className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-br from-primary to-magenta shadow-lg shadow-primary/20">
          Save Template
        </button>
      </div>
    </div>
  );
}

// ── Template Card ──────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: CatalogueTemplate;
  onEdit: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onEdit, onDelete }: TemplateCardProps) {
  const { state } = useMerchPad();
  const { settings } = state;
  const currency = settings.currency ?? 'EUR';
  const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  return (
    <div className="mp-card p-3.5 border-border/50 hover:border-primary/30 transition-all duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-sm font-bold text-foreground truncate">{template.name}</p>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-tighter">
              {template.category}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {template.variantAxes.map(axis => (
              <span key={axis.key} className="px-1.5 py-0.5 rounded-md text-[10px] text-muted-foreground bg-muted border border-border">
                <span className="font-bold text-primary/80">{axis.key}:</span> {axis.values.slice(0, 3).join(', ')}{axis.values.length > 3 ? '…' : ''}
              </span>
            ))}
            {template.variantAxes.length === 0 && (
              <span className="text-[10px] text-muted-foreground/60 italic">No axes defined</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs font-bold text-primary">
              {symbol}{template.defaultPrice.toFixed(2)}
            </p>
            {template.notes && (
              <p className="text-[10px] text-muted-foreground truncate italic">• {template.notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

type View = 'list' | 'create' | 'edit';

export default function MasterCatalogue({ onBack }: { onBack: () => void }) {
  const [templates, setTemplates] = useState<CatalogueTemplate[]>([]);
  const [view, setView] = useState<View>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState('all');

  useEffect(() => { setTemplates(loadCatalogue()); }, []);

  const categories = ['all', ...getAllCategories(templates)];
  const filtered = filterCat === 'all' ? templates : templates.filter(t => t.category === filterCat);
  const editingTemplate = editingId ? templates.find(t => t.id === editingId) : undefined;

  function handleCreate(data: Omit<CatalogueTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    addTemplate(data);
    setTemplates(loadCatalogue());
    setView('list');
    toast.success(`Template "${data.name}" created`);
  }

  function handleUpdate(data: Omit<CatalogueTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!editingId) return;
    updateTemplate(editingId, data);
    setTemplates(loadCatalogue());
    setView('list');
    setEditingId(null);
    toast.success('Template updated');
  }

  function handleDelete(id: string, name: string) {
    deleteTemplate(id);
    setTemplates(loadCatalogue());
    toast.success(`"${name}" removed from catalogue`);
  }

  return (
    <div className="mp-master-catalogue min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-foreground/80 mb-4 transition-colors">
            ← Back to Settings
          </button>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-primary" />
            <h1 className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.03em' }}>Item Template Creator</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Define reusable item templates with variant axes</p>
        </div>
        {view === 'list' && (
          <button onClick={() => setView('create')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-primary to-magenta shadow-lg shadow-primary/20">
            <Plus size={14} /> New Template
          </button>
        )}
      </div>

      <div className="px-4 pb-8 space-y-4">
        {view === 'list' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Templates', value: templates.length, icon: Layers },
                { label: 'Categories', value: categories.length - 1, icon: Tag },
                { label: 'Axes', value: Array.from(new Set(templates.flatMap(t => t.variantAxes.map(a => a.key)))).length, icon: ChevronRight },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="mp-card p-3 text-center border-border/40">
                  <Icon size={14} className="text-primary mx-auto mb-1" />
                  <p className="text-lg font-black text-foreground">{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</p>
                </div>
              ))}
            </div>

            {/* Category filter */}
            {categories.length > 2 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={cn('flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border',
                      filterCat === cat
                        ? 'text-white bg-gradient-to-r from-primary to-magenta border-transparent shadow-md shadow-primary/20'
                        : 'text-muted-foreground bg-muted border-border hover:border-primary/50'
                    )}>
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Template list */}
            <div className="space-y-2">
              {filtered.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={() => { setEditingId(t.id); setView('edit'); }}
                  onDelete={() => handleDelete(t.id, t.name)}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 bg-muted/30 rounded-3xl border border-dashed border-border/60">
                  <BookOpen size={32} className="text-muted/60 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No templates found in this category</p>
                  <button onClick={() => { setFilterCat('all'); setView('create'); }}
                    className="mt-4 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-br from-primary to-magenta shadow-lg shadow-primary/20">
                    Create First Template
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'create' && (
          <div className="mp-card p-4 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={16} className="text-primary" />
              <p className="text-sm font-black text-foreground uppercase tracking-tight">New Template</p>
            </div>
            <TemplateEditor
              onSave={handleCreate}
              onCancel={() => setView('list')}
            />
          </div>
        )}

        {view === 'edit' && editingTemplate && (
          <div className="mp-card p-4 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Pencil size={16} className="text-primary" />
              <p className="text-sm font-black text-foreground uppercase tracking-tight">Edit Template</p>
            </div>
            <TemplateEditor
              initial={editingTemplate}
              onSave={handleUpdate}
              onCancel={() => { setView('list'); setEditingId(null); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
