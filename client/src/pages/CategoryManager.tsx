import { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { 
  loadCustomCategories, 
  addCustomCategory, 
  deleteCustomCategory, 
  loadCatalogue,
  getAllCategories
} from '../lib/catalogue';

export default function CategoryManager({ onBack }: { onBack: () => void }) {
  const [customCats, setCustomCats] = useState<string[]>([]);
  const [allCats, setAllCats] = useState<string[]>([]);
  const [newCat, setNewCat] = useState('');

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    setCustomCats(loadCustomCategories());
    setAllCats(getAllCategories(loadCatalogue()));
  }

  function handleAdd() {
    const val = newCat.trim();
    if (!val) return;
    if (allCats.map(c => c.toLowerCase()).includes(val.toLowerCase())) {
      toast.error('Category already exists');
      return;
    }
    addCustomCategory(val);
    setNewCat('');
    refresh();
    toast.success('Category added');
  }

  function handleDelete(cat: string) {
    deleteCustomCategory(cat);
    refresh();
    toast.success('Category removed');
  }

  return (
    <div className="min-h-full animate-fade-in">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-foreground/80 mb-4 transition-colors">
            ← Back to Settings
          </button>
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-primary" />
            <h1 className="text-xl font-black text-foreground" style={{ letterSpacing: '-0.03em' }}>Categories</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Manage global product categories</p>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-6">
        {/* Add Category */}
        <div className="mp-card p-4 border-primary/20">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">New Category</label>
          <div className="flex gap-2">
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Merchandise"
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-muted border border-border focus:border-primary focus:outline-none"
            />
            <button onClick={handleAdd}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-magenta shadow-lg shadow-primary/20">
              Add
            </button>
          </div>
        </div>

        {/* Custom Categories List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Categories</p>
            <span className="text-[10px] text-muted-foreground font-mono">{customCats.length}</span>
          </div>
          
          {customCats.length > 0 ? (
            <div className="space-y-2">
              {customCats.map(cat => (
                <div key={cat} className="mp-card p-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Hash size={14} className="text-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground">{cat}</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(cat)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-2xl border border-dashed border-border/60">
              <p className="text-xs text-muted-foreground italic">No custom categories yet</p>
            </div>
          )}
        </div>

        {/* Built-in / System Categories */}
        <div className="space-y-3 opacity-60">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">System & Auto-generated</p>
          <div className="flex flex-wrap gap-2">
            {allCats.filter(c => !customCats.includes(c)).map(cat => (
              <span key={cat} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-muted border border-border text-muted-foreground">
                {cat}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground px-1 italic">
            These are either system defaults or derived from existing templates. They cannot be deleted here.
          </p>
        </div>
      </div>
    </div>
  );
}
