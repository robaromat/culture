import type { Category, Item, Status, Tag } from '../model/types';
import type { ItemDraft } from '../model/ops';
import { fold } from '../model/filter';

// Export d'une liste IMDb (Watchlist…) → fiches Culture.
// Colonnes reconnues par leur nom (anglais ou français, accents et casse ignorés). Une colonne ajoutée à la main
// dont le nom commence par « statut » / « status » est lue : vide = à voir, « en cours », « vu » / « terminé ».

export interface Candidate {
  imdbId: string;
  title: string;
  originalTitle: string;
  year: number | null;
  directors: string;
  category: Category; // film ou série
  typeLabel: string; // tel qu'écrit par IMDb
  status: Status;
  rating: number; // ta note IMDb /10 convertie en /5 (0 = aucune)
  genres: string[];
  addedAt: string | null;
  /** id d'une fiche Culture qui semble être la même. */
  duplicateOf: string | null;
}

const COLS = {
  id: ['const', 'id', 'imdb id', 'tconst'],
  title: ['title', 'titre'],
  original: ['original title', 'titre original'],
  type: ['title type', 'type'],
  year: ['year', 'annee'],
  directors: ['directors', 'realisateurs', 'realisation'],
  created: ['created', 'date added', 'ajoute le', 'cree'],
  rating: ['your rating', 'ma note', 'votre note'],
  genres: ['genres'],
};

const SERIES_TYPES = ['tv series', 'tv mini series', 'tvseries', 'tvminiseries', 'serie', 'mini-serie', 'tv episode', 'podcast series'];

export function categoryFromType(t: string): Category {
  const f = fold(t);
  return SERIES_TYPES.some((s) => f.includes(s)) || /\bseries?\b/.test(f) ? 'serie' : 'film';
}

export function statusFromCell(raw: string | undefined, category: Category): Status {
  const f = fold(raw ?? '').trim();
  if (!f) return 'a_decouvrir';
  if (f.includes('cours')) return category === 'serie' ? 'en_cours' : 'a_decouvrir';
  if (/^(vu|vue|vus|termine|terminee|fini|finie|done|watched)\b/.test(f)) return 'termine';
  return 'a_decouvrir';
}

/** Date IMDb : « 2022-05-21 » (CSV) ou nombre de jours Excel (le fichier passé par Excel). */
export function parseDate(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const days = Number(s);
    if (days > 20000 && days < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(days) * 864e5).toISOString();
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export type ParseResult = { ok: true; candidates: Candidate[]; skipped: number } | { ok: false; message: string };

export function parseImdbRows(rows: string[][], existing: readonly Item[]): ParseResult {
  const [header, ...body] = rows;
  if (!header) return { ok: false, message: 'Le fichier est vide.' };
  const h = header.map((x) => fold(x).trim());
  const find = (names: string[]) => h.findIndex((x) => names.includes(x));
  const ix = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, find(names)])) as Record<keyof typeof COLS, number>;
  const statusIx = h.findIndex((x) => x.startsWith('statut') || x.startsWith('status'));
  if (ix.id < 0 || ix.title < 0)
    return { ok: false, message: 'Ce fichier ne ressemble pas à un export IMDb (colonnes « Const » et « Title » introuvables).' };

  const byImdb = new Map(existing.filter((i) => i.source.imdbId).map((i) => [i.source.imdbId!, i.id]));
  const byTitle = new Map(existing.map((i) => [`${i.category}|${fold(i.title)}|${i.year ?? ''}`, i.id]));
  const seen = new Set<string>();
  const out: Candidate[] = [];
  let skipped = 0;

  for (const r of body) {
    const cell = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '');
    const imdbId = cell(ix.id).match(/tt\d+/)?.[0];
    const title = cell(ix.title);
    if (!imdbId || !title || seen.has(imdbId)) {
      skipped++;
      continue;
    }
    seen.add(imdbId);
    const typeLabel = cell(ix.type);
    const category = categoryFromType(typeLabel);
    const yearNum = Number(cell(ix.year).slice(0, 4));
    const year = Number.isFinite(yearNum) && yearNum > 1800 ? yearNum : null;
    const ratingRaw = Number(cell(ix.rating).replace(',', '.'));
    const status = statusFromCell(statusIx >= 0 ? r[statusIx] : undefined, category);
    out.push({
      imdbId,
      title,
      originalTitle: cell(ix.original),
      year,
      directors: cell(ix.directors).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 2).join(', '),
      category,
      typeLabel,
      status,
      rating: ratingRaw > 0 ? Math.max(1, Math.min(5, Math.round(ratingRaw / 2))) : 0,
      genres: cell(ix.genres).split(',').map((s) => s.trim()).filter(Boolean),
      addedAt: parseDate(cell(ix.created)),
      duplicateOf: byImdb.get(imdbId) ?? byTitle.get(`${category}|${fold(title)}|${year ?? ''}`) ?? null,
    });
  }
  return { ok: true, candidates: out, skipped };
}

/** Tags existants dont le nom correspond à un genre IMDb (« Comédie » → tag « comédie »). */
export function tagsFromGenres(genres: string[], tags: readonly Tag[]): string[] {
  const g = new Set(genres.map(fold));
  return tags.filter((t) => g.has(fold(t.name))).map((t) => t.id);
}

export function candidateToDraft(c: Candidate, extraTags: string[], tags: readonly Tag[], matchGenres: boolean): ItemDraft & { addedAt?: string } {
  const tagIds = [...new Set([...extraTags, ...(matchGenres ? tagsFromGenres(c.genres, tags) : [])])];
  return {
    category: c.category,
    title: c.title,
    creator: c.directors,
    year: c.year,
    cover: null,
    status: c.status,
    rating: c.status === 'termine' ? c.rating : 0,
    tags: tagIds,
    notes: '',
    link: `https://www.imdb.com/title/${c.imdbId}/`,
    source: { provider: 'imdb', id: c.imdbId, subtype: null, imdbId: c.imdbId },
    recommendedBy: '',
    ...(c.addedAt ? { addedAt: c.addedAt } : {}),
  };
}
