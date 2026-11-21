import type { TrackedProvider } from '../settings/settings';

// Disponibilité (données JustWatch via TMDB /watch/providers), pays France.
// On garde ce qui ne coûte rien de plus : « flatrate » (inclus dans l'abonnement), « free » (gratuit : Arte, France TV)
// et « ads » (gratuit avec pub). Location, achat et chaînes payantes vendues via Prime Video (« … Amazon Channel »)
// sont ignorées.

export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
}

export interface WatchProviders {
  results?: Record<string, { flatrate?: TmdbProvider[]; free?: TmdbProvider[]; ads?: TmdbProvider[] } | undefined>;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Reconnaît un fournisseur suivi par son id TMDB, ou à défaut par son nom (ids qui changent, offres « avec pub »…). */
function matches(p: TmdbProvider, t: TrackedProvider): boolean {
  if (t.tmdbIds.includes(p.provider_id)) return true;
  const n = fold(p.provider_name);
  if (n.includes('channel')) return false; // chaînes vendues en supplément
  return [t.name, ...(t.aliases ?? [])].some((name) => {
    const k = fold(name);
    return n === k || n.startsWith(`${k} `);
  }) || (t.key === 'prime' && n.startsWith('amazon prime video'));
}

/** Clés des abonnements suivis (tous, activés ou non : le filtrage se fait à l'affichage) où le titre est inclus. */
export function trackedAvailability(wp: WatchProviders | undefined, tracked: TrackedProvider[], region = 'FR'): string[] {
  const r = wp?.results?.[region];
  const offers = [...(r?.flatrate ?? []), ...(r?.free ?? []), ...(r?.ads ?? [])];
  return tracked.filter((t) => offers.some((p) => matches(p, t))).map((t) => t.key);
}

export const STALE_AFTER_DAYS = 7;

/** Date d'ajout de nouveaux fournisseurs suivis (Arte, France TV) : les vérifications antérieures sont à refaire. */
export const PROVIDERS_CHANGED_AT = '2026-11-21T00:00:00Z';

export function isStale(checkedAt: string | undefined, now = Date.now()): boolean {
  if (!checkedAt || checkedAt < PROVIDERS_CHANGED_AT) return true;
  return now - new Date(checkedAt).getTime() > STALE_AFTER_DAYS * 864e5;
}
