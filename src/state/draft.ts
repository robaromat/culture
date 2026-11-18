import { signal } from '@preact/signals';
import type { ItemDraft } from '../model/ops';

/** Fiche pré-remplie choisie dans les résultats, en attente de validation dans le formulaire. */
export const pendingDraft = signal<Partial<ItemDraft> | null>(null);

/** Adresse d'article collée dans l'écran Ajouter, à lire dans l'écran « Depuis un article ». */
export const pendingArticleUrl = signal<string | null>(null);
