import { ProviderError, type SearchResult } from './types';

// Open Library : sans clé. Recherche d'œuvres + couverture. Pas de lien « Ouvrir » pour les livres (choix de Robin).

const API = 'https://openlibrary.org';
const cover = (id: number | undefined, size: 'M' | 'L' = 'L') => (id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : null);

interface Doc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  editions?: { docs?: { title?: string; cover_i?: number }[] };
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const url = new URL(`${API}/search.json`);
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'fr'); // préfère les éditions françaises (titre, couverture)
  url.searchParams.set('limit', '12');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,editions,editions.title,editions.cover_i');
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ProviderError('Pas de connexion à Open Library.');
  }
  if (!res.ok) throw new ProviderError(`Open Library a répondu ${res.status}.`);
  const body = (await res.json()) as { docs: Doc[] };
  return body.docs.map((d) => {
    const ed = d.editions?.docs?.[0];
    const title = ed?.title || d.title;
    const coverId = ed?.cover_i ?? d.cover_i;
    const creator = (d.author_name ?? []).slice(0, 2).join(', ');
    const year = d.first_publish_year ?? null;
    return {
      key: `ol:${d.key}`,
      category: 'livre' as const,
      title,
      creator,
      year,
      cover: cover(coverId, 'M'),
      sourceId: d.key,
      resolve: async () => ({
        title,
        creator,
        year,
        cover: cover(coverId),
        link: null,
        source: { provider: 'openlibrary' as const, id: d.key, subtype: null },
      }),
    };
  });
}

/** Lien openlibrary.org/works/OL…W (ou /books/OL…M) collé. */
export async function bookFromUrl(url: URL): Promise<SearchResult | null> {
  const m = url.pathname.match(/\/(works|books)\/(OL\d+[WM])/);
  if (!m) return null;
  const res = await fetch(`${API}/${m[1]}/${m[2]}.json`);
  if (!res.ok) throw new ProviderError('Œuvre introuvable sur Open Library.');
  const j = (await res.json()) as { title: string; covers?: number[]; works?: { key: string }[]; authors?: { author?: { key: string }; key?: string }[]; first_publish_date?: string; publish_date?: string };
  const authorKeys = (j.authors ?? []).map((a) => a.author?.key ?? a.key).filter((k): k is string => !!k).slice(0, 2);
  const names = await Promise.all(
    authorKeys.map(async (k) => {
      try {
        const r = await fetch(`${API}${k}.json`);
        return r.ok ? ((await r.json()) as { name?: string }).name ?? '' : '';
      } catch {
        return '';
      }
    }),
  );
  const workKey = m[1] === 'works' ? `/works/${m[2]}` : (j.works?.[0]?.key ?? `/books/${m[2]}`);
  const yearMatch = (j.first_publish_date ?? j.publish_date ?? '').match(/\d{4}/);
  const year = yearMatch ? Number(yearMatch[0]) : null;
  const creator = names.filter(Boolean).join(', ');
  const c = cover(j.covers?.[0]);
  return {
    key: `ol:${workKey}`,
    category: 'livre',
    title: j.title,
    creator,
    year,
    cover: cover(j.covers?.[0], 'M'),
    sourceId: workKey,
    resolve: async () => ({ title: j.title, creator, year, cover: c, link: null, source: { provider: 'openlibrary', id: workKey, subtype: null } }),
  };
}
