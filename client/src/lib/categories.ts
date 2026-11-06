/**
 * Product categories — common defaults + user-defined custom ones.
 * Stored in localStorage (global, not per-project).
 */

const CATEGORIES_STORAGE_KEY = 'moshly_catalogue_categories';

// Product templates were removed — drop their leftover storage
try { localStorage.removeItem('moshly_master_catalogue'); } catch { /* ignore */ }

export function loadCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    return raw ? JSON.parse(raw) as string[] : [];
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories: string[]): void {
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

export function addCustomCategory(category: string): void {
  const cats = loadCustomCategories();
  const trimmed = category.trim();
  if (trimmed && !cats.includes(trimmed)) {
    saveCustomCategories([...cats, trimmed].sort());
  }
}

export function deleteCustomCategory(category: string): void {
  saveCustomCategories(loadCustomCategories().filter(c => c !== category));
}

const COMMON_CATEGORIES = ['Apparel', 'Accessories', 'Print', 'Music', 'Digital', 'Other'];

/** All unique categories: common + custom */
export function getAllCategories(): string[] {
  return Array.from(new Set([...COMMON_CATEGORIES, ...loadCustomCategories()])).sort();
}
