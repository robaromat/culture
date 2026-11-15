import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { Cover } from '../components/Cover';
import { CAT_ICON, CATEGORY_ORDER } from '../components/catIcon';
import { CATEGORIES } from '../model/labels';
import type { Category } from '../model/types';
import { hrefFor, hrefOf, navigate } from '../router';
import { fCategory } from '../state/ui';
import { pendingDraft } from '../state/draft';
import { engine } from '../sync/store';
import { settings } from '../settings/settings';
import { searchBooks } from '../providers/openlibrary';
import { searchTmdb } from '../providers/tmdb';
import { searchSpotify, spotifyConnected } from '../providers/spotify';
import { guessCategory, looksLikeLink, resultFromLink } from '../providers/links';
import { ProviderError, type SearchResult } from '../providers/types';

const PLACEHOLDER: Record<Category, string> = {
  livre: 'Titre ou auteur, ou lien Open Library…',
  film: 'Titre du film, ou lien TMDB / IMDb…',
  serie: 'Titre de la série, ou lien TMDB / IMDb…',
  musique: 'Album, titre ou artiste, ou lien Spotify…',
  podcast: 'Émission ou épisode, ou lien Spotify…',
  autre: '',
};
const SOURCE: Record<Category, string> = { livre: 'Open Library', film: 'TMDB', serie: 'TMDB', musique: 'Spotify', podcast: 'Spotify', autre: '' };

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; results: SearchResult[]; fromLink: boolean }
  | { kind: 'error'; message: string; needs?: 'tmdb' | 'spotify' };

function canSearch(cat: Category): { ok: true } | { ok: false; needs: 'tmdb' | 'spotify'; message: string } {
  if ((cat === 'film' || cat === 'serie') && !settings.value.tmdbKey)
    return { ok: false, needs: 'tmdb', message: 'Pour chercher films et séries, ajoute ta clé TMDB dans Réglages. Tu peux aussi saisir la fiche à la main.' };
  if ((cat === 'musique' || cat === 'podcast') && !spotifyConnected.value)
    return { ok: false, needs: 'spotify', message: 'Colle un lien Spotify (Partager → Copier le lien), ou connecte Spotify dans Réglages pour chercher directement.' };
  return { ok: true };
}

async function runSearch(cat: Category, q: string, signal: AbortSignal): Promise<SearchResult[]> {
  switch (cat) {
    case 'livre': return searchBooks(q, signal);
    case 'film': return searchTmdb('movie', q, signal);
    case 'serie': return searchTmdb('tv', q, signal);
    case 'musique':
    case 'podcast': return searchSpotify(cat, q, signal);
    default: return [];
  }
}

export function Add() {
  const [cat, setCat] = useState<Category>(fCategory.value === 'all' ? 'film' : fCategory.value);
  const [q, setQ] = useState('');
  const [st, setSt] = useState<State>({ kind: 'idle' });
  const [picking, setPicking] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const data = engine.value?.data.value;

  // Recherche (avec un petit délai pendant la frappe) ou lecture du lien collé.
  useEffect(() => {
    abort.current?.abort();
    const query = q.trim();
    if (!query || cat === 'autre') return setSt({ kind: 'idle' });
    const ctrl = new AbortController();
    abort.current = ctrl;
    const isLink = looksLikeLink(query);
    if (!isLink) {
      const can = canSearch(cat);
      if (!can.ok) return setSt({ kind: 'error', message: can.message, needs: can.needs });
    }
    setSt({ kind: 'loading' });
    const t = setTimeout(async () => {
      try {
        if (isLink) {
          const r = await resultFromLink(query);
          if (ctrl.signal.aborted) return;
          if (!r) setSt({ kind: 'error', message: 'Lien non reconnu. Tu peux saisir la fiche à la main : le lien sera gardé.' });
          else setSt({ kind: 'results', results: [r], fromLink: true });
        } else {
          const results = await runSearch(cat, query, ctrl.signal);
          if (!ctrl.signal.aborted) setSt({ kind: 'results', results, fromLink: false });
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError' || ctrl.signal.aborted) return;
        setSt({ kind: 'error', message: e instanceof ProviderError ? e.message : 'La recherche a échoué. Réessaie.' });
      }
    }, isLink ? 0 : 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, cat]);

  function onInput(v: string) {
    setQ(v);
    if (looksLikeLink(v)) {
      const g = guessCategory(v);
      if (g && g !== cat) setCat(g);
    }
  }

  const already = (r: SearchResult) => data?.items.find((i) => i.source.id === r.sourceId && i.category === r.category);

  async function pick(r: SearchResult) {
    setPicking(r.key);
    try {
      const d = await r.resolve();
      pendingDraft.value = { category: r.category, ...d };
      navigate({ name: 'addForm', category: d.category ?? r.category });
    } catch (e) {
      setSt({ kind: 'error', message: e instanceof ProviderError ? e.message : 'Impossible de récupérer les détails.' });
    } finally {
      setPicking(null);
    }
  }

  function manual() {
    pendingDraft.value = looksLikeLink(q) ? { link: q.trim() } : q.trim() ? { title: q.trim() } : null;
    navigate({ name: 'addForm', category: cat });
  }

  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <h1 class="h-title">Ajouter</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="chips wrap" role="group" aria-label="Catégorie">
          {CATEGORY_ORDER.map((c) => (
            <button key={c} class="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              <Icon name={CAT_ICON[c]} />
              {CATEGORIES[c].label}
            </button>
          ))}
        </div>
        {cat === 'autre' ? (
          <div class="manual">
            <span>Une expo, une pièce, un restaurant, un jeu… Tu saisis la fiche à la main, avec un lien si tu veux.</span>
            <a class="btn primary small" href={hrefOf({ name: 'addForm', category: 'autre' })} onClick={() => (pendingDraft.value = null)}>
              <Icon name="edit" />Créer la fiche
            </a>
          </div>
        ) : (
          <>
            <div class="searchbox">
              <Icon name={looksLikeLink(q) ? 'link' : 'search'} />
              <input
                id="addq"
                type="search"
                autocomplete="off"
                enterKeyHint="search"
                placeholder={PLACEHOLDER[cat]}
                aria-label="Rechercher ou coller un lien"
                value={q}
                onInput={(e) => onInput(e.currentTarget.value)}
              />
              {q && (
                <button class="iconbtn" aria-label="Effacer" onClick={() => setQ('')}><Icon name="close" /></button>
              )}
            </div>
            <p class="hint">Recherche dans {SOURCE[cat]}, ou colle un lien Spotify, TMDB, IMDb ou Open Library.</p>
            <Results st={st} cat={cat} picking={picking} already={already} onPick={pick} />
            <div class="manual row-manual">
              <span>Pas trouvé ?</span>
              <button class="btn small" onClick={manual}><Icon name="edit" />Saisir à la main</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Results({ st, cat, picking, already, onPick }: {
  st: State; cat: Category; picking: string | null;
  already: (r: SearchResult) => { id: string } | undefined;
  onPick: (r: SearchResult) => void;
}) {
  if (st.kind === 'idle') return null;
  if (st.kind === 'loading') return <p class="hint">Recherche…</p>;
  if (st.kind === 'error')
    return (
      <div class="detected warn" role="status">
        <span>{st.message}</span>
        {st.needs && <a class="linkbtn" href={hrefFor('settings')}>Ouvrir les réglages</a>}
      </div>
    );
  if (!st.results.length) return <p class="hint">Aucun résultat. Essaie un autre mot, ou saisis la fiche à la main.</p>;
  return (
    <>
      {st.fromLink && <div class="detected"><Icon name="check" />Lien reconnu · {CATEGORIES[st.results[0]!.category].label}</div>}
      {(cat === 'musique' || cat === 'podcast') && !st.fromLink && <p class="hint">Résultats Spotify (limités à quelques-uns par type).</p>}
      <div class="results">
        {st.results.map((r) => {
          const dup = already(r);
          return (
            <div class="res" key={r.key}>
              <button class="res-main" disabled={!!picking} onClick={() => onPick(r)}>
                <div class="thumb"><Cover category={r.category} title={r.title} creator={r.creator} cover={r.cover} /></div>
                <div class="res-txt">
                  <div class="r-title">{r.title}</div>
                  <div class="r-meta">{[r.kind, r.creator, r.year].filter(Boolean).join(' · ')}</div>
                </div>
                <span class="plus">{picking === r.key ? <span class="spin" aria-label="Chargement" /> : <Icon name="plus" />}</span>
              </button>
              {dup && <a class="linkbtn dup" href={hrefOf({ name: 'item', id: dup.id })}><Icon name="check" />Déjà dans ta liste</a>}
            </div>
          );
        })}
      </div>
    </>
  );
}
