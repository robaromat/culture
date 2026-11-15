import { computed, effect, signal } from '@preact/signals';
import type { Category } from '../model/types';
import type { SortKey, StatusFilter } from '../model/filter';

// État d'affichage de la bibliothèque (filtres, tri, vue). Le tri et la vue sont retenus sur l'appareil.

const PREFS_KEY = 'culture.prefs.v1';

function loadPrefs(): { sort: SortKey; view: 'list' | 'grid' } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { sort?: SortKey; view?: 'list' | 'grid' };
    return { sort: p.sort ?? 'added', view: p.view ?? 'list' };
  } catch {
    return { sort: 'added', view: 'list' };
  }
}
const prefs = loadPrefs();

export const fCategory = signal<Category | 'all'>('all');
export const fStatus = signal<StatusFilter>('a_decouvrir');
export const fTags = signal<string[]>([]);
export const fQuery = signal('');
export const fSubs = signal(false);
export const sortKey = signal<SortKey>(prefs.sort);
export const viewMode = signal<'list' | 'grid'>(prefs.view);
export const sheet = signal<null | 'tags' | 'sort'>(null);

effect(() => {
  const v = { sort: sortKey.value, view: viewMode.value };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(v));
  } catch {
    /* préférence non retenue, sans gravité */
  }
});

export const hasActiveFilters = computed(
  () => fCategory.value !== 'all' || fStatus.value !== 'a_decouvrir' || fTags.value.length > 0 || fQuery.value !== '' || fSubs.value,
);

export function resetFilters(): void {
  fCategory.value = 'all';
  fStatus.value = 'a_decouvrir';
  fTags.value = [];
  fQuery.value = '';
  fSubs.value = false;
}

export function toggleTagFilter(id: string): void {
  fTags.value = fTags.value.includes(id) ? fTags.value.filter((x) => x !== id) : [...fTags.value, id];
}

// --- Messages brefs (toasts)
export const toast = signal<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function showToast(msg: string): void {
  toast.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2800);
}
