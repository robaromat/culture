import { useMemo } from 'preact/hooks';
import { SyncBadge } from '../components/SyncBadge';
import { Icon } from '../components/Icon';
import { Cover } from '../components/Cover';
import { ProviderBadges, Stars, TagChip, enabledProviderKeys } from '../components/bits';
import { CAT_ICON, CATEGORY_ORDER } from '../components/catIcon';
import { engine } from '../sync/store';
import { hrefFor, hrefOf, navigate, route } from '../router';
import { CATEGORIES, statusLabel } from '../model/labels';
import { filterItems, sortItems, SORT_LABELS, type StatusFilter } from '../model/filter';
import type { DataFile, Item, Tag } from '../model/types';
import { fCategory, fQuery, fStatus, fSubs, fTags, hasActiveFilters, resetFilters, sheet, sortKey, viewMode } from '../state/ui';
import { ItemDetail } from './ItemDetail';
import { pendingSearch } from '../state/draft';

function statusFilterLabel(s: StatusFilter): string {
  const cat = fCategory.value === 'all' ? null : CATEGORIES[fCategory.value];
  if (s === 'all') return 'Tout';
  if (s === 'en_cours') return 'En cours';
  if (s === 'a_decouvrir') return cat ? cat.todo : 'À voir';
  return cat ? cat.donePlural : 'Déjà vus';
}

/** « En cours » n'a de sens que pour les séries : proposé sur « Tout » et « Séries ». */
function statusOptions(): StatusFilter[] {
  const c = fCategory.value;
  return c === 'all' || c === 'serie' || fStatus.value === 'en_cours' ? ['a_decouvrir', 'en_cours', 'termine', 'all'] : ['a_decouvrir', 'termine', 'all'];
}

export function Library() {
  const e = engine.value;
  const data = e?.data.value;
  const r = route.value;
  const selectedId = r.name === 'item' ? r.id : null;

  if (!data) {
    return (
      <div class="page">
        <div class="page-in">
          <header class="head">
            <span class="wordmark">Cult<em>ure</em></span>
            <span class="spacer" />
            <SyncBadge />
          </header>
          <div class="settings">
            {e?.status.value === 'error' ? (
              <section class="card">
                <h2>Impossible de charger tes données</h2>
                <p class="testres err">{e.error.value}</p>
                <p><a class="linkbtn" href={hrefFor('settings')}>Vérifier les réglages</a></p>
              </section>
            ) : (
              <section class="card"><p class="small">Chargement de tes données…</p></section>
            )}
          </div>
        </div>
      </div>
    );
  }

  const selected = selectedId ? data.items.find((i) => i.id === selectedId) : undefined;
  return (
    <div class={`lib ${selectedId ? 'has-detail' : ''}`}>
      <section class="listpane" aria-label="Fiches">
        <LibraryList data={data} selectedId={selectedId} />
      </section>
      <section class={`detailpane ${selected ? 'open' : ''}`} aria-label="Fiche">
        {selected ? (
          <ItemDetail item={selected} tags={data.tags} />
        ) : selectedId ? (
          <div class="placeholder show"><div><div class="h-title">Fiche introuvable</div><p>Elle a peut-être été supprimée sur un autre appareil.</p><a class="linkbtn" href="#/">Retour à la liste</a></div></div>
        ) : (
          null
        )}
      </section>
    </div>
  );
}

function LibraryList({ data, selectedId }: { data: DataFile; selectedId: string | null }) {
  const filters = {
    category: fCategory.value,
    status: fStatus.value,
    tags: fTags.value,
    query: fQuery.value,
    onlyProviders: fSubs.value ? enabledProviderKeys() : null,
  };
  const items = useMemo(
    () => sortItems(filterItems(data.items, filters), sortKey.value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, filters.category, filters.status, filters.tags, filters.query, fSubs.value, sortKey.value],
  );
  const tagMap = useMemo(() => new Map(data.tags.map((t) => [t.id, t])), [data.tags]);
  const n = items.length;

  return (
    <>
      <header class="head">
        <span class="wordmark">Cult<em>ure</em></span>
        <span class="spacer" />
        <SyncBadge />
      </header>
      <SyncAlert />
      <div class="searchbox">
        <Icon name="search" />
        <input
          id="q"
          type="search"
          placeholder="Rechercher un titre, un auteur, une note…"
          aria-label="Rechercher"
          value={fQuery.value}
          onInput={(ev) => (fQuery.value = ev.currentTarget.value)}
        />
      </div>
      <div class="chips cats" role="group" aria-label="Catégorie">
        <button class="chip" aria-pressed={fCategory.value === 'all'} onClick={() => (fCategory.value = 'all')}>Tout</button>
        {CATEGORY_ORDER.map((c) => (
          <button key={c} class="chip" aria-pressed={fCategory.value === c} onClick={() => (fCategory.value = c)}>
            <Icon name={CAT_ICON[c]} />
            {CATEGORIES[c].plural}
          </button>
        ))}
      </div>
      <div class="filters">
        <span class="stseg" role="group" aria-label="Statut">
          {statusOptions().map((s) => (
            <button key={s} aria-pressed={fStatus.value === s} onClick={() => (fStatus.value = s)}>
              {statusFilterLabel(s)}
            </button>
          ))}
        </span>
        <button class={`fbtn tagsbtn ${fTags.value.length ? 'on' : ''}`} onClick={() => (sheet.value = 'tags')}>
          <Icon name="tag" />
          {fTags.value.length ? `Tags · ${fTags.value.length}` : 'Tags'}
        </button>
        <button class={`fbtn ${fSubs.value ? 'on' : ''}`} aria-pressed={fSubs.value} onClick={() => (fSubs.value = !fSubs.value)}>
          Sur mes abonnements
        </button>
        <button class="fbtn" onClick={() => (sheet.value = 'sort')}>
          <Icon name="sort" />
          {SORT_LABELS[sortKey.value]}
        </button>
        <span class="viewtoggle" role="group" aria-label="Affichage">
          <button aria-pressed={viewMode.value === 'list'} aria-label="Liste" onClick={() => (viewMode.value = 'list')}><Icon name="list" /></button>
          <button aria-pressed={viewMode.value === 'grid'} aria-label="Grille" onClick={() => (viewMode.value = 'grid')}><Icon name="grid" /></button>
        </span>
      </div>
      <div class="count">{n} fiche{n > 1 ? 's' : ''}</div>
      {n === 0 ? (
        <EmptyState total={data.items.length} />
      ) : viewMode.value === 'grid' ? (
        <div class="grid">
          {items.map((it) => (
            <a key={it.id} class="cell" href={hrefOf({ name: 'item', id: it.id })} aria-current={selectedId === it.id ? 'true' : undefined}>
              <div class="shelf"><Cover category={it.category} title={it.title} creator={it.creator} cover={it.cover} /></div>
              <div class="g-title">{it.title}</div>
              <div class="g-meta"><ProviderBadges item={it} /><Stars value={it.rating} /></div>
            </a>
          ))}
        </div>
      ) : (
        <div class="list">
          {items.map((it) => (
            <Row key={it.id} it={it} tagMap={tagMap} current={selectedId === it.id} />
          ))}
        </div>
      )}
      {n > 0 && fQuery.value.trim() && (
        <div class="list-more"><span class="small">Pas ce que tu cherches ?</span><AddFromSearch q={fQuery.value.trim()} /></div>
      )}
    </>
  );
}

/** Synchro bloquée (jeton expiré, droits retirés…) : le dire franchement, avec le chemin pour réparer. */
function SyncAlert() {
  const e = engine.value;
  if (!e || e.status.value !== 'error' || !e.error.value) return null;
  const isToken = /jeton/i.test(e.error.value);
  return (
    <div class="detected warn sync-alert" role="alert">
      <span>
        {isToken
          ? 'Ton jeton GitHub a été refusé (il a sans doute expiré). Tes modifications restent sur cet appareil en attendant.'
          : `Synchronisation impossible : ${e.error.value}`}
      </span>
      <a class="linkbtn" href={hrefFor('settings')}>{isToken ? 'Mettre à jour le jeton' : 'Ouvrir les réglages'}</a>
    </div>
  );
}

function Row({ it, tagMap, current }: { it: Item; tagMap: Map<string, Tag>; current: boolean }) {
  return (
    <a class="row" href={hrefOf({ name: 'item', id: it.id })} aria-current={current ? 'true' : undefined}>
      <div class="thumb"><Cover category={it.category} title={it.title} creator={it.creator} cover={it.cover} /></div>
      <div class="r-body">
        <div class="r-title">{it.title}</div>
        <div class="r-meta">{[it.creator, it.year].filter(Boolean).join(' · ')}</div>
        <div class="r-line">
          {it.status === 'termine' && (
            <span class="st done"><Icon name="check" />{statusLabel('termine', it.category)}</span>
          )}
          {it.status === 'en_cours' && <span class="st doing">{statusLabel('en_cours', it.category)}</span>}
          <Stars value={it.rating} />
          <ProviderBadges item={it} />
          {it.tags.map((id) => {
            const t = tagMap.get(id);
            return t ? <TagChip key={id} tag={t} /> : null;
          })}
        </div>
      </div>
    </a>
  );
}

function EmptyState({ total }: { total: number }) {
  if (total === 0) {
    return (
      <div class="empty">
        <div class="h-title">Ta liste est vide</div>
        <p>Ajoute un premier livre, film ou album avec le bouton +.</p>
        <p><a class="btn small primary" href={hrefFor('add')}><Icon name="plus" />Ajouter une fiche</a></p>
      </div>
    );
  }
  const q = fQuery.value.trim();
  if (q) {
    // Le titre existe peut-être, mais masqué par un autre filtre (statut, catégorie, tags…).
    const elsewhere = filterItems(engine.value?.data.value?.items ?? [], { category: 'all', status: 'all', tags: [], query: q, onlyProviders: null }).length;
    return (
      <div class="empty">
        <div class="h-title">« {q} » n'est pas dans ta liste</div>
        {elsewhere > 0 && (
          <p>
            {elsewhere} fiche{elsewhere > 1 ? 's' : ''} correspond{elsewhere > 1 ? 'ent' : ''} avec d'autres filtres.{' '}
            <button class="linkbtn" onClick={() => showAllFor(q)}>Les voir</button>
          </p>
        )}
        <p><AddFromSearch q={q} primary /></p>
      </div>
    );
  }
  return (
    <div class="empty">
      <div class="h-title">Rien ici pour l'instant</div>
      <p>Aucune fiche ne correspond à ces filtres.</p>
      {hasActiveFilters.value && <p><button class="btn small" onClick={resetFilters}>Effacer les filtres</button></p>}
    </div>
  );
}

/** Garde la recherche, enlève les autres filtres. */
function showAllFor(q: string) {
  resetFilters();
  fStatus.value = 'all';
  fQuery.value = q;
}

/** « Chercher « … » pour l'ajouter » : ouvre l'écran Ajouter avec ce texte, sur toutes les sources. */
function AddFromSearch({ q, primary }: { q: string; primary?: boolean }) {
  return (
    <button class={`btn small ${primary ? 'primary' : ''}`} onClick={() => { pendingSearch.value = q; navigate({ name: 'add' }); }}>
      <Icon name="plus" />Chercher « {q} » pour l'ajouter
    </button>
  );
}
