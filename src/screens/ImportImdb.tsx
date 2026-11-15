import { useMemo, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { engine, mutate } from '../sync/store';
import { settings } from '../settings/settings';
import { back, hrefFor } from '../router';
import { readSheetFile } from '../import/sheets';
import { candidateToDraft, parseImdbRows, tagsFromGenres, type Candidate } from '../import/imdb';
import { enrichImported, enrichState, needsEnrichment } from '../import/enrich';
import { addItems, createTag, TAG_COLORS } from '../model/ops';
import { statusesFor, statusLabel } from '../model/labels';
import type { Category, Status } from '../model/types';

type Row = Candidate & { selected: boolean };
type View = 'all' | 'film' | 'serie' | 'dup';

export function ImportImdb() {
  const data = engine.value?.data.value;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('all');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [matchGenres, setMatchGenres] = useState(true);
  const [imported, setImported] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pendingEnrich = data?.items.filter(needsEnrichment).length ?? 0;
  const es = enrichState.value;

  async function onFile(ev: Event) {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0];
    (ev.currentTarget as HTMLInputElement).value = '';
    if (!f || !data) return;
    setError(null);
    try {
      const r = parseImdbRows(await readSheetFile(f), data.items);
      if (!r.ok) return setError(r.message);
      setRows(r.candidates.map((c) => ({ ...c, selected: !c.duplicateOf })));
      setSkipped(r.skipped);
      setImported(null);
    } catch (e) {
      setError(`Fichier illisible : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const visible = useMemo(
    () => (rows ?? []).filter((r) => (view === 'all' ? true : view === 'dup' ? !!r.duplicateOf : r.category === view)),
    [rows, view],
  );
  const selectedCount = rows?.filter((r) => r.selected).length ?? 0;
  const dupCount = rows?.filter((r) => r.duplicateOf).length ?? 0;
  const genreTags = useMemo(() => {
    if (!rows || !data) return [];
    const ids = new Set(rows.flatMap((r) => tagsFromGenres(r.genres, data.tags)));
    return data.tags.filter((t) => ids.has(t.id));
  }, [rows, data]);

  const patch = (imdbId: string, p: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.imdbId === imdbId ? { ...r, ...p } : r)));
  const setAllVisible = (selected: boolean) => {
    const keys = new Set(visible.map((r) => r.imdbId));
    setRows((rs) => rs!.map((r) => (keys.has(r.imdbId) ? { ...r, selected } : r)));
  };

  function doImport() {
    if (!rows || !data) return;
    const chosen = rows.filter((r) => r.selected);
    if (!chosen.length) return;
    const name = newTag.trim();
    mutate((d) => {
      let next = d;
      const extra = [...tagIds];
      if (name) {
        const r = createTag(next, name, TAG_COLORS[next.tags.length % TAG_COLORS.length]!);
        next = r.data;
        extra.push(r.tag.id);
      }
      // Ordre de la Watchlist conservé : le plus récemment ajouté en tête.
      const drafts = chosen.map((c) => candidateToDraft(c, extra, next.tags, matchGenres));
      return addItems(next, drafts).data;
    });
    setImported(chosen.length);
    setRows(null);
    if (settings.value.tmdbKey) void enrichImported();
  }

  if (!data) return null;
  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <button class="iconbtn" aria-label="Retour" onClick={() => back({ name: 'settings' })}><Icon name="back" /></button>
          <h1 class="h-title">Importer depuis IMDb</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="settings">
          {imported !== null && (
            <section class="card">
              <h2><Icon name="check" />{imported} fiche{imported > 1 ? 's' : ''} ajoutée{imported > 1 ? 's' : ''}</h2>
              <p class="small">Enregistrées en une seule fois dans ton dépôt GitHub.</p>
              <a class="btn small primary" href={hrefFor('library')}>Voir la bibliothèque</a>
            </section>
          )}

          {(pendingEnrich > 0 || es.running) && (
            <section class="card">
              <h2><Icon name="film" />Affiches et disponibilités</h2>
              {es.running ? (
                <>
                  <progress class="progress" max={es.total} value={es.done} />
                  <p class="small">{es.done} / {es.total} fiches complétées via TMDB… Tu peux continuer à utiliser l'app.</p>
                </>
              ) : (
                <>
                  <p class="small">
                    {pendingEnrich} fiche{pendingEnrich > 1 ? 's' : ''} importée{pendingEnrich > 1 ? 's' : ''} sans affiche ni disponibilité Netflix / Prime / Canal+.
                    {es.done > 0 && es.failed > 0 ? ` ${es.failed} titre${es.failed > 1 ? 's' : ''} introuvable${es.failed > 1 ? 's' : ''} sur TMDB.` : ''}
                  </p>
                  {es.error && <p class="testres err">{es.error}</p>}
                  {settings.value.tmdbKey ? (
                    <button class="btn small" onClick={() => void enrichImported()}><Icon name="refresh" />Compléter maintenant</button>
                  ) : (
                    <a class="linkbtn" href={hrefFor('settings')}>Ajouter ma clé TMDB dans Réglages</a>
                  )}
                </>
              )}
            </section>
          )}

          {!rows && (
            <section class="card">
              <h2><Icon name="upload" />Choisir le fichier</h2>
              <p class="lead">
                Sur imdb.com : ta Watchlist → menu ⋮ → Exporter, puis télécharge le fichier dans la page « Exports ». Le .csv d'origine comme un
                .xlsx retouché dans Excel conviennent. Rien n'est enregistré avant ta validation.
              </p>
              <p class="small">
                Une colonne « Statut » ajoutée à la main est lue : vide = à voir, « en cours » (séries), « vu ».
              </p>
              <div>
                <button class="btn primary small" onClick={() => fileRef.current?.click()}><Icon name="upload" />Choisir un fichier</button>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={onFile} />
              </div>
              {error && <p class="testres err">{error}</p>}
            </section>
          )}

          {rows && (
            <>
              <section class="card">
                <h2>{rows.length} titres trouvés</h2>
                <p class="small">
                  {rows.filter((r) => r.category === 'film').length} films · {rows.filter((r) => r.category === 'serie').length} séries
                  {dupCount ? ` · ${dupCount} déjà dans Culture (décochés)` : ''}
                  {skipped ? ` · ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''} (doublon ou incomplète)` : ''}
                </p>
                <div class="field">
                  <span class="flabel">Tags à ajouter à toutes les fiches importées</span>
                  <div class="tagpick">
                    {data.tags.map((t) => (
                      <button key={t.id} type="button" class="tag" style={{ '--tc': t.color }} aria-pressed={tagIds.includes(t.id)} onClick={() => setTagIds(tagIds.includes(t.id) ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id])}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <input class="input" placeholder="Nouveau tag, ex. watchlist IMDb (facultatif)" value={newTag} onInput={(e) => setNewTag(e.currentTarget.value)} />
                </div>
                {genreTags.length > 0 && (
                  <label class="checkline">
                    <input type="checkbox" checked={matchGenres} onChange={(e) => setMatchGenres(e.currentTarget.checked)} />
                    <span>Ajouter automatiquement {genreTags.map((t) => `« ${t.name} »`).join(', ')} selon les genres IMDb</span>
                  </label>
                )}
              </section>

              <div class="chips wrap" role="group" aria-label="Afficher">
                {([['all', `Tout (${rows.length})`], ['film', 'Films'], ['serie', 'Séries'], ['dup', `Déjà dans Culture (${dupCount})`]] as [View, string][]).map(([v, l]) => (
                  <button key={v} class="chip" aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>
                ))}
              </div>
              <div class="btnrow">
                <button class="btn small ghost" onClick={() => setAllVisible(true)}>Tout cocher</button>
                <button class="btn small ghost" onClick={() => setAllVisible(false)}>Tout décocher</button>
              </div>

              <div class="imp-list">
                {visible.map((r) => (
                  <div key={r.imdbId} class={`imp-row ${r.selected ? '' : 'off'}`}>
                    <input type="checkbox" aria-label={`Importer ${r.title}`} checked={r.selected} onChange={(e) => patch(r.imdbId, { selected: e.currentTarget.checked })} />
                    <div class="imp-txt">
                      <div class="r-title">{r.title}</div>
                      <div class="r-meta">{[r.year, r.directors].filter(Boolean).join(' · ')}</div>
                      {r.duplicateOf && <div class="small warn-txt">Déjà dans Culture</div>}
                    </div>
                    <div class="imp-sel">
                      <select class="input" aria-label="Catégorie" value={r.category} onChange={(e) => {
                        const category = e.currentTarget.value as Category;
                        patch(r.imdbId, { category, status: statusesFor(category).includes(r.status) ? r.status : 'a_decouvrir' });
                      }}>
                        <option value="film">Film</option>
                        <option value="serie">Série</option>
                      </select>
                      <select class="input" aria-label="Statut" value={r.status} onChange={(e) => patch(r.imdbId, { status: e.currentTarget.value as Status })}>
                        {statusesFor(r.category).map((s) => <option key={s} value={s}>{statusLabel(s, r.category)}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div class="savebar">
                <button class="btn ghost" onClick={() => setRows(null)}>Annuler</button>
                <button class="btn primary" disabled={!selectedCount} onClick={doImport}>
                  <Icon name="check" />Importer {selectedCount} fiche{selectedCount > 1 ? 's' : ''}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
