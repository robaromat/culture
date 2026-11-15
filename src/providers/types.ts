import type { Category } from '../model/types';
import type { ItemDraft } from '../model/ops';

/** Un résultat de recherche affiché dans l'écran Ajouter. `resolve` va chercher les détails au moment du choix. */
export interface SearchResult {
  key: string; // unique dans la liste, ex. « tmdb:movie:915935 »
  category: Category;
  title: string;
  creator: string;
  year: number | null;
  cover: string | null;
  /** Ligne d'info en plus : « Album », « Émission »… */
  kind?: string;
  /** Pour repérer « déjà dans ta liste ». */
  sourceId: string;
  resolve: () => Promise<Partial<ItemDraft>>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export const yearOf = (date: string | null | undefined): number | null => {
  const y = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 0 ? y : null;
};
