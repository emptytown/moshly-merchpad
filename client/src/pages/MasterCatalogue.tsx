/**
 * MasterCatalogue — global product template manager
 * Accessible from Settings. Templates are global (not per-project).
 * Each template defines: name, category, variant axes (key + suggested values), default price.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronRight, X, Tag, Layers, BookOpen } from 'lucide-react';
import {
  CatalogueTemplate, VariantAxis,
  loadCatalogue, addTemplate, updateTemplate, deleteTemplate,
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
      className="w-full px-2 py-1.5 rounded-lg text-xs text-[#E6E7EB] bg-[#141624] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
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
      <p className="text-xs font-bold text-[#7B7F93] uppercase tracking-wider">Variant Axes</p>

      {axes.map(axis => (
        <div key={axis.key} className="rounded-xl p-3" style={{ background: '#0E0F14', border: '1px solid #2D3048' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#7C6DFF] capitalize">{axis.key}</span>
            <button onClick={() => removeAxis(axis.key)} className="text-[#7B7F93] hover:text-[#F87171] transition-colors">
              <X size={12} />
            </button>
          </div>
          <AxisValueInput axisKey={axis.key} initialValues={axis.values} onCommit={vals => updateAxisValues(axis.key, vals)} />
          <p className="text-[10px] text-[#7B7F93] mt-1">Type values separated by commas (e.g. S, M, L, XL) — press Enter or click away to confirm</p>
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
            className="w-full px-3 py-2 rounded-lg text-xs text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
          />
          <datalist id="axis-key-suggestions">
            {COMMON_AXIS_KEYS.filter(k => !axes.find(a => a.key === k)).map(k => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </div>
        <button onClick={addAxis}
          className="px-3 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1"
          style={{ background: 'rgba(107,92,255,0.2)', border: '1px solid rgba(107,92,255,0.4)', color: '#7C6DFF' }}>
          <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
}

// ── Template Editor ────────────────────────────────────────────────────────

interface TemplateEditorProps {
  initial?: CatalogueTemplate;
  existingCategories: string[];
  onSave: (t: Omit<CatalogueTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

const COMMON_CATEGORIES = ['Apparel', 'Accessories', 'Print', 'Music', 'Digital', 'Other'];

function TemplateEditor({ initial, existingCategories, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [price, setPrice] = useState(String(initial?.defaultPrice ?? ''));
  const [axes, setAxes] = useState<VariantAxis[]>(initial?.variantAxes ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const allCategories = Array.from(new Set([...COMMON_CATEGORIES, ...existingCategories])).sort();

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
        <label className="block text-xs font-bold text-[#7B7F93] uppercase tracking-wider mb-1.5">Product Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. T-Shirt"
          className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-bold text-[#7B7F93] uppercase tracking-wider mb-1.5">Category</label>
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="e.g. Apparel"
          list="cat-suggestions"
          className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
        />
        <datalist id="cat-suggestions">
          {allCategories.map(c => <option key={c} value={c} />)}
        </datalist>
        <p className="text-[10px] text-[#7B7F93] mt-1">Type or pick from suggestions</p>
      </div>

      {/* Default price */}
      <div>
        <label className="block text-xs font-bold text-[#7B7F93] uppercase tracking-wider mb-1.5">Default Price (€)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="0.00"
          className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none"
        />
      </div>

      {/* Variant axes */}
      <AxisEditor axes={axes} onChange={setAxes} />

      {/* Notes */}
      <div>
        <label className="block text-xs font-bold text-[#7B7F93] uppercase tracking-wider mb-1.5">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Any notes about this template..."
          className="w-full px-3 py-2 rounded-lg text-sm text-[#E6E7EB] bg-[#0E0F14] border border-[#2D3048] focus:border-[#6B5CFF] focus:outline-none resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#A4A7B5]"
          style={{ border: '1px solid #2D3048' }}>
          Cancel
        </button>
        <button onClick={handleSave}
          className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }}>
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
  return (
    <div className="mp-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-[#E6E7EB] truncate">{template.name}</p>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0"
              style={{ background: 'rgba(107,92,255,0.15)', color: '#7C6DFF', border: '1px solid rgba(107,92,255,0.25)' }}>
              {template.category}
            </span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {template.variantAxes.map(axis => (
              <span key={axis.key} className="px-1.5 py-0.5 rounded-md text-[10px] text-[#7B7F93]"
                style={{ background: '#0E0F14', border: '1px solid #2D3048' }}>
                {axis.key}: {axis.values.slice(0, 3).join(', ')}{axis.values.length > 3 ? '…' : ''}
              </span>
            ))}
            {template.variantAxes.length === 0 && (
              <span className="text-[10px] text-[#7B7F93] italic">No axes defined</span>
            )}
          </div>
          <p className="text-xs text-[#7B7F93] mt-1.5">Default: €{template.defaultPrice.toFixed(2)}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#7B7F93] hover:text-[#7C6DFF] transition-colors"
            style={{ background: 'rgba(107,92,255,0.08)' }}>
            <Pencil size={12} />
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#7B7F93] hover:text-[#F87171] transition-colors"
            style={{ background: 'rgba(248,113,113,0.08)' }}>
            <Trash2 size={12} />
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

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category))).sort()];
  const filtered = filterCat === 'all' ? templates : templates.filter(t => t.category === filterCat);
  const editingTemplate = editingId ? templates.find(t => t.id === editingId) : undefined;
  const existingCategories = Array.from(new Set(templates.map(t => t.category)));

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
    <div className="min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-[#7C6DFF] hover:text-[#9B8FFF] mb-4 transition-colors">
            ← Back to Settings
          </button>
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#7C6DFF]" />
            <h1 className="text-xl font-black text-[#E6E7EB]" style={{ letterSpacing: '-0.03em' }}>Item Template Creator</h1>
          </div>
          <p className="text-xs text-[#7B7F93] mt-0.5">Define reusable item templates with variant axes</p>
        </div>
        {view === 'list' && (
          <button onClick={() => setView('create')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }}>
            <Plus size={13} /> New
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
                <div key={label} className="mp-card p-3 text-center">
                  <Icon size={14} className="text-[#7C6DFF] mx-auto mb-1" />
                  <p className="text-lg font-black text-[#E6E7EB]">{value}</p>
                  <p className="text-[10px] text-[#7B7F93]">{label}</p>
                </div>
              ))}
            </div>

            {/* Category filter */}
            {categories.length > 2 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                      filterCat === cat ? 'text-white' : 'text-[#7B7F93] hover:text-[#A4A7B5]'
                    )}
                    style={filterCat === cat
                      ? { background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }
                      : { background: '#1B1E2E', border: '1px solid #2D3048' }}>
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
                <div className="text-center py-10">
                  <BookOpen size={28} className="text-[#2D3048] mx-auto mb-3" />
                  <p className="text-sm text-[#7B7F93]">No templates yet</p>
                  <button onClick={() => setView('create')}
                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #6B5CFF, #C026D3)' }}>
                    Create First Template
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {view === 'create' && (
          <div className="mp-card p-4">
            <p className="text-sm font-bold text-[#E6E7EB] mb-4">New Template</p>
            <TemplateEditor
              existingCategories={existingCategories}
              onSave={handleCreate}
              onCancel={() => setView('list')}
            />
          </div>
        )}

        {view === 'edit' && editingTemplate && (
          <div className="mp-card p-4">
            <p className="text-sm font-bold text-[#E6E7EB] mb-4">Edit Template</p>
            <TemplateEditor
              initial={editingTemplate}
              existingCategories={existingCategories}
              onSave={handleUpdate}
              onCancel={() => { setView('list'); setEditingId(null); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
