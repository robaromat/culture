import { bookFromUrl } from './openlibrary';
import { spotifyFromLink } from './spotify';
import { findByImdb, tmdbDraft, type TmdbKind } from './tmdb';
import { ProviderError, type SearchResult } from './types';
import type { Category } from '../model/types';

// « Coller un lien » : reconnaît Spotify, TMDB, IMDb et Open Library, et en tire une fiche pré-remplie.

export const looksLikeLink = (s: string) => /^(https?:\/\/|spotify:)/i.test(s.trim());

/** Catégorie devinée d'après l'adresse seule (pour basculer l'écran avant même la réponse réseau). */
export function guessCategory(raw: string): Category | null {
  const s = raw.trim();
  if (/^spotify:(show|episode):/.test(s) || /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(show|episode)\//.test(s)) return 'podcast';
  if (/^spotify:/.test(s) || /open\.spotify\.com\//.test(s) || /spotify\.link\//.test(s)) return 'musique';
  if (/themoviedb\.org\/tv\//.test(s)) return 'serie';
  if (/themoviedb\.org\/movie\//.test(s) || /imdb\.com\/(?:[a-z-]+\/)?title\/tt\d+/.test(s)) return 'film';
  if (/openlibrary\.org\/(works|books)\//.test(s)) return 'livre';
  return null;
}

function tmdbResult(kind: TmdbKind, id: string | number): SearchResult {
  const category = kind === 'movie' ? ('film' as const) : ('serie' as const);
  let cached: Promise<Awaited<ReturnType<typeof tmdbDraft>>> | null = null;
  const load = () => (cached ??= tmdbDraft(kind, id));
  return {
    key: `tmdb:${kind}:${id}`,
    category,
    title: '',
    creator: '',
    year: null,
    cover: null,
    sourceId: String(id),
    resolve: load,
  };
}

/** Renvoie un résultat prêt à afficher (titre, image…) ou null si le lien n'est pas reconnu. */
export async function resultFromLink(raw: string): Promise<SearchResult | null> {
  const s = raw.trim();
  const sp = await spotifyFromLink(s);
  if (sp) return sp;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'themoviedb.org') {
    const m = url.pathname.match(/^\/(movie|tv)\/(\d+)/);
    if (!m) return null;
    return hydrate(tmdbResult(m[1] as TmdbKind, m[2]!));
  }
  if (host.endsWith('imdb.com')) {
    const m = url.pathname.match(/title\/(tt\d+)/);
    if (!m) return null;
    const found = await findByImdb(m[1]!);
    if (!found) throw new ProviderError('Ce titre IMDb n’existe pas encore sur TMDB : saisis-le à la main.');
    return hydrate(tmdbResult(found.kind, found.id));
  }
  if (host === 'openlibrary.org') return bookFromUrl(url);
  return null;
}

/** Charge les détails TMDB tout de suite pour afficher titre et affiche dans la liste de résultats. */
async function hydrate(r: SearchResult): Promise<SearchResult> {
  const d = await r.resolve();
  return { ...r, title: d.title ?? '', creator: d.creator ?? '', year: d.year ?? null, cover: d.cover ?? null };
}
