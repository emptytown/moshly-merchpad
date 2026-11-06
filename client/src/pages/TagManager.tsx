/**
 * TagManager — per-project product tags (Settings → Tags).
 * Tags replace the legacy categories. None are pre-created: a tag exists only
 * once the user creates it (here or in the product editor).
 */
import { useState, useMemo } from 'react';
import { Tag, Trash2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { loadTags, addTag, deleteTag } from '../lib/catalogue';
import { useMerchPad } from '../contexts/MerchPadContext';
import { productTags } from '../lib/db';

export default function TagManager({ onBack }: { onBack: () => void }) {
  const { state, saveProduct } = useMerchPad();
  const [stored, setStored] = useState<string[]>(() => loadTags());
  const [newTag, setNewTag] = useState('');

  // Tags = the stored list + any tag already used on a product of this project
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    stored.forEach(t => m.set(t, 0));
    state.products.forEach(p => productTags(p).forEach(t => m.set(t, (m.get(t) ?? 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [stored, state.products]);

  function handleAdd() {
    const val = newTag.trim();
    if (!val) return;
    if (usage.some(([t]) => t.toLowerCase() === val.toLowerCase())) {
      toast.error('Tag already exists');
      return;
    }
    addTag(val);
    setStored(loadTags());
    setNewTag('');
    toast.success('Tag added');
  }

  async function handleDelete(tag: string, count: number) {
    if (count > 0 && !confirm(`Remove "${tag}" from ${count} product${count > 1 ? 's' : ''}?`)) return;
    deleteTag(tag);
    for (const p of state.products) {
      const tags = productTags(p);
      if (tags.includes(tag)) {
        await saveProduct({ ...p, tags: tags.filter(t => t !== tag), updatedAt: new Date().toISOString() });
      }
    }
    setStored(loadTags());
    toast.success('Tag removed');
  }

  return (
    <div className="min-h-full animate-fade-in">
      <div className="px-4 pt-4 pb-3">
        <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-primary mb-4">
          ← Back to Settings
        </button>
        <div className="flex items-center gap-2">
          <Tag size={18} className="text-primary" />
          <h1 className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.03em' }}>Tags</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Tags for this project's products</p>
      </div>

      <div className="px-4 pb-8 space-y-6">
        <div className="mp-card p-4">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">New Tag</label>
          <div className="flex gap-2">
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Vinyl"
              className="flex-1 min-w-0 h-11 px-3 rounded-xl text-sm bg-muted border border-border focus:border-primary focus:outline-none"
            />
            <button onClick={handleAdd} className="px-4 h-11 rounded-xl text-sm font-bold text-white mp-btn-primary">
              Add
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tags</p>
            <span className="text-[10px] text-muted-foreground font-mono">{usage.length}</span>
          </div>
          {usage.length > 0 ? usage.map(([tag, count]) => (
            <div key={tag} className="mp-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Hash size={14} className="text-primary" />
                </div>
                <span className="text-sm font-bold text-foreground truncate">{tag}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{count} product{count === 1 ? '' : 's'}</span>
              </div>
              <button onClick={() => handleDelete(tag, count)} aria-label={`Delete ${tag}`}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive">
                <Trash2 size={16} />
              </button>
            </div>
          )) : (
            <div className="text-center py-8 rounded-2xl border border-dashed border-border/60">
              <p className="text-xs text-muted-foreground italic">No tags yet — add one here or in a product</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
