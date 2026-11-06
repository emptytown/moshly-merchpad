/**
 * Master Catalogue — product templates
 * Stored in localStorage PER PROJECT (key suffixed with the active project id),
 * so one project's templates/tags never show up in another.
 * The old global keys are legacy and intentionally not migrated.
 * Templates define reusable product names, variant axes, and default prices.
 * Used by the Product Editor in Merch Office to pre-fill and constrain inputs.
 */

import { getActiveProjectId } from './projects';

export interface VariantAxis {
  key: string;       // e.g. "size", "colour", "format"
  values: string[];  // e.g. ["S", "M", "L", "XL"] — suggested values
}

export interface CatalogueTemplate {
  id: string;
  name: string;           // e.g. "T-Shirt"
  /** @deprecated legacy — templates no longer carry a category */
  category?: string;
  variantAxes: VariantAxis[];
  defaultPrice: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const projectKey = (base: string) => `${base}:${getActiveProjectId() ?? 'default'}`;
const storageKey = () => projectKey('moshly_master_catalogue');
const tagsKey = () => projectKey('moshly_tags');

// ── Tags (per project, user-created only — nothing pre-created) ────────────

export function loadTags(): string[] {
  try {
    const raw = localStorage.getItem(tagsKey());
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveTags(tags: string[]): void {
  localStorage.setItem(tagsKey(), JSON.stringify(tags));
}

/** Adds a tag (case-insensitive dedupe) and returns the stored spelling. */
export function addTag(tag: string): string | null {
  const t = tag.trim();
  if (!t) return null;
  const tags = loadTags();
  const existing = tags.find(x => x.toLowerCase() === t.toLowerCase());
  if (existing) return existing;
  saveTags([...tags, t].sort((x, y) => x.localeCompare(y)));
  return t;
}

export function deleteTag(tag: string): void {
  saveTags(loadTags().filter(t => t !== tag));
}

export function loadCatalogue(): CatalogueTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? (JSON.parse(raw) as CatalogueTemplate[]) : defaultCatalogue();
  } catch {
    return defaultCatalogue();
  }
}

export function saveCatalogue(templates: CatalogueTemplate[]): void {
  localStorage.setItem(storageKey(), JSON.stringify(templates));
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
    _legacyCategory: string,
    axes: VariantAxis[],
    price: number
  ): CatalogueTemplate => ({
    id: crypto.randomUUID(),
    name,
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
