/**
 * Master Catalogue — global product templates
 * Stored in localStorage (global, not per-project).
 * Templates define reusable product names, categories, variant axes, and default prices.
 * Used by the Product Editor in Merch Office to pre-fill and constrain inputs.
 */

export interface VariantAxis {
  key: string;       // e.g. "size", "colour", "format"
  values: string[];  // e.g. ["S", "M", "L", "XL"] — suggested values
}

export interface CatalogueTemplate {
  id: string;
  name: string;           // e.g. "T-Shirt"
  category: string;       // e.g. "Apparel"
  variantAxes: VariantAxis[];
  defaultPrice: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'moshly_master_catalogue';
const CATEGORIES_STORAGE_KEY = 'moshly_catalogue_categories';

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

export function loadCatalogue(): CatalogueTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CatalogueTemplate[]) : defaultCatalogue();
  } catch {
    return defaultCatalogue();
  }
}

export function saveCatalogue(templates: CatalogueTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function addTemplate(template: Omit<CatalogueTemplate, 'id' | 'createdAt' | 'updatedAt'>): CatalogueTemplate {
  const templates = loadCatalogue();
  const now = new Date().toISOString();
  const newTemplate: CatalogueTemplate = {
    ...template,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  saveCatalogue([...templates, newTemplate]);
  return newTemplate;
}

export function updateTemplate(id: string, patch: Partial<Omit<CatalogueTemplate, 'id' | 'createdAt'>>): void {
  const templates = loadCatalogue();
  saveCatalogue(templates.map(t =>
    t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
  ));
}

export function deleteTemplate(id: string): void {
  saveCatalogue(loadCatalogue().filter(t => t.id !== id));
}

const COMMON_CATEGORIES = ['Apparel', 'Accessories', 'Print', 'Music', 'Digital', 'Other'];

/** All unique categories across the catalogue + custom + common */
export function getAllCategories(templates: CatalogueTemplate[]): string[] {
  const custom = loadCustomCategories();
  const fromTemplates = templates.map(t => t.category).filter(Boolean);
  return Array.from(new Set([...COMMON_CATEGORIES, ...fromTemplates, ...custom])).sort();
}

/** All unique axis keys across the catalogue */
export function getCatalogueAxisKeys(templates: CatalogueTemplate[]): string[] {
  const keys = new Set<string>();
  templates.forEach(t => t.variantAxes.forEach(a => keys.add(a.key)));
  return Array.from(keys).sort();
}

/** Seed with sensible defaults on first load */
function defaultCatalogue(): CatalogueTemplate[] {
  const now = new Date().toISOString();
  const make = (
    name: string,
    category: string,
    axes: VariantAxis[],
    price: number
  ): CatalogueTemplate => ({
    id: crypto.randomUUID(),
    name,
    category,
    variantAxes: axes,
    defaultPrice: price,
    createdAt: now,
    updatedAt: now,
  });

  const catalogue = [
    make('T-Shirt', 'Apparel', [
      { key: 'size', values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
      { key: 'colour', values: ['Black', 'White', 'Grey', 'Navy'] },
    ], 25),
    make('Hoodie', 'Apparel', [
      { key: 'size', values: ['S', 'M', 'L', 'XL', 'XXL'] },
      { key: 'colour', values: ['Black', 'White', 'Grey'] },
    ], 55),
    make('Cap', 'Apparel', [
      { key: 'style', values: ['Snapback', 'Dad Cap', 'Beanie'] },
      { key: 'colour', values: ['Black', 'White', 'Navy'] },
    ], 30),
    make('Tote Bag', 'Accessories', [
      { key: 'colour', values: ['Black', 'Natural', 'Navy'] },
    ], 20),
    make('Poster', 'Print', [
      { key: 'size', values: ['A3', 'A2', 'A1'] },
      { key: 'finish', values: ['Matte', 'Gloss'] },
    ], 15),
    make('Vinyl Record', 'Music', [
      { key: 'edition', values: ['Standard', 'Deluxe', 'Coloured'] },
    ], 30),
    make('CD', 'Music', [
      { key: 'edition', values: ['Standard', 'Signed'] },
    ], 15),
    make('Sticker Pack', 'Print', [
      { key: 'pack', values: ['Standard', 'Large'] },
    ], 8),
    make('Enamel Pin', 'Accessories', [
      { key: 'design', values: ['Logo', 'Character', 'Tour'] },
    ], 12),
    make('Wristband', 'Accessories', [
      { key: 'type', values: ['Fabric', 'Rubber', 'Tyvek'] },
    ], 5),
  ];

  saveCatalogue(catalogue);
  return catalogue;
}
