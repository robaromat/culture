import type { Category, Status } from './types';

interface CategoryInfo {
  label: string;
  plural: string;
  todo: string;
  done: string;
  donePlural: string;
}

export const CATEGORIES: Record<Category, CategoryInfo> = {
  livre: { label: 'Livre', plural: 'Livres', todo: 'À lire', done: 'Lu', donePlural: 'Lus' },
  film: { label: 'Film', plural: 'Films', todo: 'À voir', done: 'Vu', donePlural: 'Vus' },
  serie: { label: 'Série', plural: 'Séries', todo: 'À voir', done: 'Vue', donePlural: 'Vues' },
  musique: { label: 'Musique', plural: 'Musique', todo: 'À écouter', done: 'Écouté', donePlural: 'Écoutés' },
  podcast: { label: 'Podcast', plural: 'Podcasts', todo: 'À écouter', done: 'Écouté', donePlural: 'Écoutés' },
  autre: { label: 'Autre', plural: 'Autres', todo: 'À faire', done: 'Fait', donePlural: 'Faits' },
};

/** Libellé du statut d'une fiche, adapté à sa catégorie (« À lire », « Vu »…). */
export function statusLabel(status: Status, category?: Category): string {
  if (status === 'a_decouvrir') return category ? CATEGORIES[category].todo : 'À voir';
  if (status === 'en_cours') return 'En cours';
  return category ? CATEGORIES[category].done : 'Vu';
}

/** Statuts proposés pour une catégorie : « En cours » seulement pour les séries. */
export function statusesFor(category: Category): Status[] {
  return category === 'serie' ? ['a_decouvrir', 'en_cours', 'termine'] : ['a_decouvrir', 'termine'];
}
