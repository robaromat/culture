import { settings } from '../settings/settings';
import { trackedAvailability, type WatchProviders } from './availability';
import { ProviderError, yearOf, type SearchResult } from './types';
import type { Availability } from '../model/types';
import type { ItemDraft } from '../model/ops';

// TMDB : films et séries. On accepte la « clé API » v3 (32 caractères) comme le « jeton d'accès en lecture » v4 (commence par eyJ).

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
export type TmdbKind = 'movie' | 'tv';

export function tmdbRequest(path: string, key: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
  const k = key.trim();
  const isBearer = k.startsWith('eyJ');
  const url = new URL(API + path);
  for (const [p, v] of Object.entries(params)) url.searchParams.set(p, v);
  if (!isBearer) url.searchParams.set('api_key', k);
  return fetch(url, { headers: isBearer ? { Authorization: `Bearer ${k}` } : {}, signal });
}

async function get<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const key = settings.value.tmdbKey;
  if (!key) throw new ProviderError('Ajoute ta clé TMDB dans Réglages pour chercher films et séries.');
  let res: Response;
  try {
    res = await tmdbRequest(path, key, { language: 'fr-FR', ...params }, signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ProviderError('Pas de connexion à TMDB.');
  }
  if (res.status === 401) throw new ProviderError('Clé TMDB refusée : vérifie-la dans Réglages.');
  if (res.status === 404) throw new ProviderError('Titre introuvable sur TMDB.');
  if (!res.ok) throw new ProviderError(`TMDB a répondu ${res.status}.`);
  return (await res.json()) as T;
}

export async function testTmdbKey(key: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!key.trim()) return { ok: false, message: 'Aucune clé saisie.' };
  try {
    const res = await tmdbRequest('/configuration', key);
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: 'Clé refusée par TMDB : vérifie qu’elle est complète.' };
    return { ok: false, message: `TMDB a répondu ${res.status}.` };
  } catch {
    return { ok: false, message: 'Pas de connexion à TMDB.' };
  }
}

const poster = (path: string | null | undefined, size = 'w342') => (path ? `${IMG}/${size}${path}` : null);
export const tmdbPageUrl = (kind: TmdbKind, id: number | string) => `https://www.themoviedb.org/${kind}/${id}`;

interface SearchHit {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  original_title?: string;
  original_name?: string;
}

export async function searchTmdb(kind: TmdbKind, query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const body = await get<{ results: SearchHit[] }>(`/search/${kind}`, { query, include_adult: 'false', region: 'FR' }, signal);
  return body.results.slice(0, 12).map((h) => {
    const title = (kind === 'movie' ? h.title : h.name) ?? '';
    const original = kind === 'movie' ? h.original_title : h.original_name;
    return {
      key: `tmdb:${kind}:${h.id}`,
      category: kind === 'movie' ? ('film' as const) : ('serie' as const),
      title,
      creator: original && original !== title ? original : '',
      year: yearOf(kind === 'movie' ? h.release_date : h.first_air_date),
      cover: poster(h.poster_path, 'w185'),
      sourceId: String(h.id),
      resolve: () => tmdbDraft(kind, h.id),
    };
  });
}

interface Details {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  created_by?: { name: string }[];
  credits?: { crew?: { job: string; name: string }[] };
  external_ids?: { imdb_id?: string | null };
  imdb_id?: string | null;
  'watch/providers'?: WatchProviders;
}

/** Détails complets au moment du choix : réalisateur / créateurs, affiche, lien, id IMDb, disponibilité. */
export async function tmdbDraft(kind: TmdbKind, id: number | string): Promise<Partial<ItemDraft>> {
  const d = await get<Details>(`/${kind}/${id}`, { append_to_response: 'credits,external_ids,watch/providers' });
  const directors = (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);
  const creators = kind === 'tv' ? (d.created_by ?? []).map((c) => c.name) : directors;
  const availability: Availability = {
    providers: trackedAvailability(d['watch/providers'], settings.value.providers),
    checkedAt: new Date().toISOString(),
  };
  return {
    category: kind === 'movie' ? 'film' : 'serie',
    title: (kind === 'movie' ? d.title : d.name) ?? '',
    creator: [...new Set(creators)].slice(0, 2).join(', '),
    year: yearOf(kind === 'movie' ? d.release_date : d.first_air_date),
    cover: poster(d.poster_path, 'w500'),
    link: tmdbPageUrl(kind, d.id),
    source: { provider: 'tmdb', id: String(d.id), subtype: null, imdbId: d.external_ids?.imdb_id ?? d.imdb_id ?? null },
    availability,
  };
}

/** Disponibilité seule (rafraîchissement, bouton « Vérifier maintenant »). */
export async function fetchAvailability(kind: TmdbKind, id: string): Promise<Availability> {
  const wp = await get<WatchProviders>(`/${kind}/${id}/watch/providers`);
  return { providers: trackedAvailability(wp, settings.value.providers), checkedAt: new Date().toISOString() };
}

/** Retrouve un titre TMDB à partir de son identifiant IMDb (tt…). */
export async function findByImdb(imdbId: string): Promise<{ kind: TmdbKind; id: number } | null> {
  const r = await get<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(`/find/${imdbId}`, { external_source: 'imdb_id' });
  if (r.movie_results[0]) return { kind: 'movie', id: r.movie_results[0].id };
  if (r.tv_results[0]) return { kind: 'tv', id: r.tv_results[0].id };
  return null;
}
