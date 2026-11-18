import type { Category } from '../model/types';
import { fold } from '../model/filter';
import { settings } from '../settings/settings';
import { searchBooks } from '../providers/openlibrary';
import { searchTmdb } from '../providers/tmdb';
import { searchSpotify, spotifyConnected } from '../providers/spotify';
import type { SearchResult } from '../providers/types';
import type { FoundTitle } from './article';

// Retrouve chaque titre cité dans la bonne base (TMDB, Open Library, Spotify).
// « exact » = même titre (accents et casse ignorés) : coché d'office. Sinon, proposé « à vérifier ».

export interface Match {
  result: SearchResult | null;
  exact: boolean;
}

function score(r: SearchResult, f: FoundTitle, hint: Category | null): number {
  let s = 0;
  const t = fold(f.title);
  if (fold(r.title) === t || fold(r.creator) === t) s += 4; // creator contient le titre original pour TMDB
  else if (fold(r.title).includes(t) || t.includes(fold(r.title))) s += 1;
  if (f.year && r.year && Math.abs(f.year - r.year) <= 1) s += 2;
  if (hint && r.category === hint) s += 2;
  return s;
}

export async function matchTitle(f: FoundTitle, hint: Category | null): Promise<Match> {
  const searches: Promise<SearchResult[]>[] = [];
  const wantAV = !hint || hint === 'film' || hint === 'serie';
  if (wantAV && settings.value.tmdbKey) searches.push(searchTmdb('tv', f.title), searchTmdb('movie', f.title));
  if (hint === 'livre') searches.push(searchBooks(f.title));
  if ((hint === 'musique' || hint === 'podcast') && spotifyConnected.value) searches.push(searchSpotify(hint, f.title));
  if (!searches.length) return { result: null, exact: false };
  const settled = await Promise.allSettled(searches);
  // Les 5 premiers de chaque recherche : au-delà, ce sont rarement les bons.
  const pool = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value.slice(0, 5) : []));
  if (!pool.length) return { result: null, exact: false };
  const best = pool.map((r) => ({ r, s: score(r, f, hint) })).sort((a, b) => b.s - a.s)[0]!;
  return { result: best.r, exact: best.s >= 4 };
}
