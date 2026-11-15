import type { TrackedProvider } from '../settings/settings';

// Disponibilité (données JustWatch via TMDB /watch/providers), pays France.
// On ne garde que « flatrate » = inclus dans l'abonnement ; location, achat et chaînes payantes vendues
// via Prime Video (« … Amazon Channel ») sont ignorées.

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
}

export interface WatchProviders {
  results?: Record<string, { flatrate?: TmdbProvider[] } | undefined>;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Reconnaît un fournisseur suivi par son id TMDB, ou à défaut par son nom (ids qui changent, offres « avec pub »…). */
function matches(p: TmdbProvider, t: TrackedProvider): boolean {
  if (t.tmdbIds.includes(p.provider_id)) return true;
  const n = fold(p.provider_name);
  if (n.includes('channel')) return false; // chaînes vendues en supplément
  const k = fold(t.name);
  return n === k || n.startsWith(`${k} `) || (t.key === 'prime' && n.startsWith('amazon prime video'));
}

/** Clés des abonnements suivis (tous, activés ou non : le filtrage se fait à l'affichage) où le titre est inclus. */
export function trackedAvailability(wp: WatchProviders | undefined, tracked: TrackedProvider[], region = 'FR'): string[] {
  const flat = wp?.results?.[region]?.flatrate ?? [];
  return tracked.filter((t) => flat.some((p) => matches(p, t))).map((t) => t.key);
}

export const STALE_AFTER_DAYS = 7;

export function isStale(checkedAt: string | undefined, now = Date.now()): boolean {
  if (!checkedAt) return true;
  return now - new Date(checkedAt).getTime() > STALE_AFTER_DAYS * 864e5;
}
