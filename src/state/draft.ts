import { signal } from '@preact/signals';
import type { ItemDraft } from '../model/ops';

/** Fiche pré-remplie choisie dans les résultats, en attente de validation dans le formulaire. */
export const pendingDraft = signal<Partial<ItemDraft> | null>(null);
