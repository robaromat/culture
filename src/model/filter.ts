import type { Category, Item } from './types';

export type StatusFilter = 'a_decouvrir' | 'termine' | 'all';
export type SortKey = 'added' | 'title' | 'rating' | 'year';

export interface Filters {
  category: Category | 'all';
  status: StatusFilter;
  tags: string[]; // la fiche doit avoir TOUS ces tags
  query: string;
  /** Clés des abonnements suivis ; si non vide, ne garder que les fiches disponibles sur l'un d'eux. */
  onlyProviders: string[] | null;
}

export const SORT_LABELS: Record<SortKey, string> = {
  added: 'Ajout récent',
  title: 'Titre A → Z',
  rating: 'Note',
  year: 'Année',
};

/** Minuscules sans accents : « Carrère » se trouve en tapant « carrere ». */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');

export function filterItems(items: readonly Item[], f: Filters): Item[] {
  const terms = fold(f.query).split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (f.category !== 'all' && i.category !== f.category) return false;
    if (f.status !== 'all' && i.status !== f.status) return false;
    if (!f.tags.every((t) => i.tags.includes(t))) return false;
    if (f.onlyProviders && !i.availability?.providers.some((p) => f.onlyProviders!.includes(p))) return false;
    if (terms.length) {
      const hay = fold([i.title, i.creator, i.notes, i.recommendedBy, i.year ?? ''].join(' '));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

export function sortItems(items: Item[], key: SortKey): Item[] {
  const byAdded = (a: Item, b: Item) => b.addedAt.localeCompare(a.addedAt);
  const cmp: Record<SortKey, (a: Item, b: Item) => number> = {
    added: byAdded,
    title: (a, b) => collator.compare(a.title, b.title),
    rating: (a, b) => b.rating - a.rating || byAdded(a, b),
    year: (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || byAdded(a, b),
  };
  return [...items].sort(cmp[key]);
}
