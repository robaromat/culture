import { useEffect } from 'preact/hooks';
import { Icon } from './Icon';
import { engine } from '../sync/store';
import { SORT_LABELS, type SortKey } from '../model/filter';
import { fTags, sheet, sortKey, toast, toggleTagFilter } from '../state/ui';
import { applyUpdate, updateReady } from '../pwa';

/** Panneaux du bas (téléphone) / boîtes centrées (grand écran) pour les tags et le tri. */
export function Sheet() {
  const which = sheet.value;
  useEffect(() => {
    if (!which) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (sheet.value = null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [which]);
  if (!which) return null;
  const data = engine.value?.data.value;
  const close = () => (sheet.value = null);

  return (
    <>
      <div class="backdrop" onClick={close} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={which === 'tags' ? 'Filtrer par tags' : 'Trier'}>
        <div class="grab" />
        {which === 'sort' ? (
          <>
            <h2>Trier par</h2>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <button key={k} class="opt" onClick={() => { sortKey.value = k; close(); }}>
                {SORT_LABELS[k]}
                {sortKey.value === k && <span class="ck"><Icon name="check" /></span>}
              </button>
            ))}
          </>
        ) : (
          <>
            <h2>Tags</h2>
            <p class="small">Les fiches doivent avoir tous les tags cochés.</p>
            {[...(data?.tags ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((t) => (
              <button key={t.id} class="opt" aria-pressed={fTags.value.includes(t.id)} onClick={() => toggleTagFilter(t.id)}>
                <span class="tag" style={{ '--tc': t.color }}>{t.name}</span>
                <span class="small">{data?.items.filter((i) => i.tags.includes(t.id)).length}</span>
                {fTags.value.includes(t.id) && <span class="ck"><Icon name="check" /></span>}
              </button>
            ))}
            <div class="btnrow sheet-actions">
              <button class="btn small primary" onClick={close}>Voir les fiches</button>
              {fTags.value.length > 0 && <button class="btn small ghost" onClick={() => (fTags.value = [])}>Tout décocher</button>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Bandeau discret quand une nouvelle version de l'app est prête. */
export function UpdateBanner() {
  if (!updateReady.value) return null;
  return (
    <div class="update" role="status">
      <span>Nouvelle version de Culture disponible.</span>
      <button class="btn small primary" onClick={applyUpdate}><Icon name="refresh" />Mettre à jour</button>
    </div>
  );
}

export function Toast() {
  return toast.value ? <div class="toast" role="status">{toast.value}</div> : null;
}
