import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { Cover } from '../components/Cover';
import { engine, mutate } from '../sync/store';
import { settings } from '../settings/settings';
import { back, hrefFor, navigate } from '../router';
import { pendingArticleUrl } from '../state/draft';
import { showToast } from '../state/ui';
import { categoryHint, extractTitles, fetchArticle, siteName, type ArticleText, type FoundTitle } from '../import/article';
import { matchTitle } from '../import/match';
import { addItems, createTag, TAG_COLORS, type ItemDraft } from '../model/ops';
import { CATEGORIES } from '../model/labels';
import { fold } from '../model/filter';
import { CATEGORY_ORDER } from '../components/catIcon';
import type { Category } from '../model/types';
import type { SearchResult } from '../providers/types';
import { safeHttpUrl } from '../lib/url';

interface Row {
  found: FoundTitle;
  status: 'pending' | 'done';
  result: SearchResult | null;
  exact: boolean;
  category: Category; // pour une fiche saisie à la main (titre non retrouvé)
  selected: boolean;
  duplicateOf: string | null;
}

const CONCURRENCY = 3;

export function ArticleImport() {
  const data = engine.value?.data.value;
  const [url, setUrl] = useState(pendingArticleUrl.peek() ?? '');
  const [pasted, setPasted] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<ArticleText | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [recommendedBy, setRecommendedBy] = useState('');
  const [saving, setSaving] = useState<{ done: number; total: number } | null>(null);

  // Lien venu de l'écran Ajouter : on lit l'article tout de suite.
  useEffect(() => {
    const u = pendingArticleUrl.peek();
    pendingArticleUrl.value = null;
    if (u) void readUrl(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function duplicateOf(r: SearchResult | null, title: string, category: Category): string | null {
    if (!data) return null;
    const hit = data.items.find((i) =>
      r ? (i.source.id === r.sourceId && i.category === r.category) || (i.category === r.category && fold(i.title) === fold(r.title)) : fold(i.title) === fold(title) && i.category === category,
    );
    return hit?.id ?? null;
  }

  async function analyse(a: ArticleText) {
    const titles = extractTitles(a.text);
    setArticle(a);
    setRecommendedBy(a.source);
    if (!titles.length) {
      setRows(null);
      setError('Aucun titre repéré dans cet article. Essaie de coller seulement la partie qui liste les œuvres.');
      return;
    }
    const hint = categoryHint(a.url);
    const initial: Row[] = titles.map((found) => ({
      found, status: 'pending', result: null, exact: false, category: hint ?? 'film', selected: false, duplicateOf: null,
    }));
    setRows(initial);
    // Recherche de chaque titre, quelques-uns à la fois.
    let next = 0;
    const worker = async () => {
      while (next < titles.length) {
        const k = next++;
        const f = titles[k]!;
        let m: Awaited<ReturnType<typeof matchTitle>> = { result: null, exact: false };
        try {
          m = await matchTitle(f, hint);
        } catch {
          /* titre laissé en saisie manuelle */
        }
        setRows((rs) =>
          rs!.map((r, i) => {
            if (i !== k) return r;
            const category = m.result?.category ?? r.category;
            const dup = duplicateOf(m.result, f.title, category);
            return { ...r, status: 'done', result: m.result, exact: m.exact, category, duplicateOf: dup, selected: m.exact && !dup };
          }),
        );
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  async function readUrl(u: string) {
    const clean = safeHttpUrl(u);
    if (!clean) return setError('Ce n’est pas une adresse web valide.');
    setLoading(true);
    setError(null);
    setRows(null);
    try {
      await analyse(await fetchArticle(clean));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setShowPaste(true);
    } finally {
      setLoading(false);
    }
  }

  async function readPasted() {
    if (!pasted.trim()) return;
    setError(null);
    const u = safeHttpUrl(url);
    await analyse({ title: '', source: u ? siteName(u) : '', url: u, text: pasted });
  }

  const patch = (k: number, p: Partial<Row>) => setRows((rs) => rs!.map((r, i) => (i === k ? { ...r, ...p } : r)));
  const chosen = rows?.filter((r) => r.selected) ?? [];
  const pendingCount = rows?.filter((r) => r.status === 'pending').length ?? 0;

  async function doImport() {
    if (!chosen.length || !data) return;
    setSaving({ done: 0, total: chosen.length });
    const drafts: ItemDraft[] = [];
    const note = article?.source ? `Repéré dans ${article.source}${article.title ? ` : « ${article.title} »` : ''}` : '';
    for (const [n, r] of chosen.entries()) {
      let base: Partial<ItemDraft> = { title: r.found.title, year: r.found.year, category: r.category };
      if (r.result) {
        try {
          base = { ...(await r.result.resolve()), category: r.result.category };
        } catch {
          base = { title: r.result.title, creator: r.result.creator, year: r.result.year, cover: r.result.cover, category: r.result.category };
        }
      }
      drafts.push({
        category: base.category ?? r.category,
        title: base.title || r.found.title,
        creator: base.creator ?? '',
        year: base.year ?? r.found.year ?? null,
        cover: base.cover ?? null,
        status: 'a_decouvrir',
        rating: 0,
        tags: [],
        notes: note,
        link: base.link ?? (article?.url ?? null),
        source: base.source ?? { provider: 'manual', id: null, subtype: null },
        recommendedBy: recommendedBy.trim(),
        ...(base.availability ? { availability: base.availability } : {}),
      });
      setSaving({ done: n + 1, total: chosen.length });
    }
    const name = newTag.trim();
    mutate((d) => {
      let next = d;
      const extra = [...tagIds];
      if (name) {
        const t = createTag(next, name, TAG_COLORS[next.tags.length % TAG_COLORS.length]!);
        next = t.data;
        extra.push(t.tag.id);
      }
      return addItems(next, drafts.map((dr) => ({ ...dr, tags: [...new Set(extra)] }))).data;
    });
    showToast(`${drafts.length} fiche${drafts.length > 1 ? 's' : ''} ajoutée${drafts.length > 1 ? 's' : ''}`);
    setSaving(null);
    navigate({ name: 'library' }, { replace: true });
  }

  if (!data) return null;
  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <button class="iconbtn" aria-label="Retour" onClick={() => back({ name: 'add' })}><Icon name="back" /></button>
          <h1 class="h-title">Depuis un article</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="settings">
          {!rows && (
            <section class="card">
              <p class="lead">
                Colle le lien d'un article qui recommande des films, séries, livres ou albums : Culture repère les titres cités et te
                laisse cocher ceux à ajouter.
              </p>
              <div class="field">
                <label for="art-url">Lien de l'article</label>
                <input class="input" id="art-url" type="url" inputmode="url" placeholder="https://…" value={url} onInput={(e) => setUrl(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && void readUrl(url)} />
              </div>
              <div class="btnrow">
                <button class="btn small primary" disabled={loading || !url.trim()} onClick={() => void readUrl(url)}>
                  {loading ? <><span class="spin" />Lecture de l'article…</> : <><Icon name="search" />Lire l'article</>}
                </button>
                {!showPaste && <button class="btn small ghost" onClick={() => setShowPaste(true)}>Coller le texte à la place</button>}
              </div>
              <p class="small">La page est lue via un service public (r.jina.ai) : seule l'adresse de l'article lui est transmise.</p>
              {error && <p class="testres err" role="alert">{error}</p>}
              {showPaste && (
                <div class="field">
                  <label for="art-text">Texte de l'article</label>
                  <textarea class="input" id="art-text" rows={6} placeholder="Sur la page : tout sélectionner, copier, puis coller ici." value={pasted} onInput={(e) => setPasted(e.currentTarget.value)} />
                  <div><button class="btn small" disabled={!pasted.trim()} onClick={() => void readPasted()}>Repérer les titres</button></div>
                </div>
              )}
              {!settings.value.tmdbKey && <p class="small">Sans clé TMDB, les films et séries seront ajoutés sans affiche : <a class="linkbtn" href={hrefFor('settings')}>ajouter la clé</a>.</p>}
            </section>
          )}

          {rows && (
            <>
              <section class="card">
                <h2>{rows.length} titre{rows.length > 1 ? 's' : ''} repéré{rows.length > 1 ? 's' : ''}</h2>
                {article?.title && <p class="small">{article.source} · {article.title}</p>}
                {pendingCount > 0 && <p class="small"><span class="spin" /> Recherche des fiches… ({rows.length - pendingCount}/{rows.length})</p>}
                <div class="field">
                  <label for="art-rec">Recommandé par</label>
                  <input class="input" id="art-rec" value={recommendedBy} onInput={(e) => setRecommendedBy(e.currentTarget.value)} />
                </div>
                <div class="field">
                  <span class="flabel">Tags à ajouter</span>
                  <div class="tagpick">
                    {data.tags.map((t) => (
                      <button key={t.id} type="button" class="tag" style={{ '--tc': t.color }} aria-pressed={tagIds.includes(t.id)} onClick={() => setTagIds(tagIds.includes(t.id) ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id])}>{t.name}</button>
                    ))}
                  </div>
                  <input class="input" placeholder="Nouveau tag (facultatif)" value={newTag} onInput={(e) => setNewTag(e.currentTarget.value)} />
                </div>
              </section>

              <div class="btnrow">
                <button class="btn small ghost" onClick={() => setRows(rows.map((r) => ({ ...r, selected: !r.duplicateOf })))}>Tout cocher</button>
                <button class="btn small ghost" onClick={() => setRows(rows.map((r) => ({ ...r, selected: false })))}>Tout décocher</button>
              </div>

              <div class="imp-list">
                {rows.map((r, k) => {
                  const shown = r.result;
                  const title = shown?.title ?? r.found.title;
                  return (
                    <div key={k} class={`imp-row art-row ${r.selected ? '' : 'off'}`}>
                      <input type="checkbox" aria-label={`Ajouter ${title}`} checked={r.selected} disabled={r.status === 'pending'} onChange={(e) => patch(k, { selected: e.currentTarget.checked })} />
                      <div class="art-thumb"><Cover category={r.category} title={title} creator={shown?.creator} cover={shown?.cover} /></div>
                      <div class="imp-txt">
                        <div class="r-title">{title}</div>
                        <div class="r-meta">
                          {r.status === 'pending' ? 'Recherche…' : [CATEGORIES[r.category].label, shown?.year ?? r.found.year, shown?.creator].filter(Boolean).join(' · ')}
                        </div>
                        <div class="small art-ctx">« {r.found.context} »</div>
                        {r.status === 'done' && !shown && (
                          <div class="art-manual">
                            <span class="small">Pas retrouvé : fiche à la main en</span>
                            <select class="input" aria-label="Catégorie" value={r.category} onChange={(e) => patch(k, { category: e.currentTarget.value as Category })}>
                              {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
                            </select>
                          </div>
                        )}
                        {r.status === 'done' && shown && !r.exact && <div class="small warn-txt">À vérifier : le titre trouvé ne correspond pas exactement</div>}
                        {r.duplicateOf && <div class="small warn-txt">Déjà dans ta liste</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div class="savebar">
                <button class="btn ghost" onClick={() => { setRows(null); setArticle(null); }}>Autre article</button>
                <button class="btn primary" disabled={!chosen.length || !!saving} onClick={() => void doImport()}>
                  {saving ? <><span class="spin" />{saving.done}/{saving.total}</> : <><Icon name="check" />Ajouter {chosen.length} fiche{chosen.length > 1 ? 's' : ''}</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
