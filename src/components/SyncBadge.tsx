import { engine } from '../sync/store';
import { relativeTime } from '../lib/time';

const LABELS = {
  loading: 'Chargement…',
  ok: 'À jour',
  pending: 'En attente',
  syncing: 'Synchro…',
  offline: 'Hors ligne',
  error: 'Erreur de synchro',
} as const;

/** Indicateur discret de synchronisation ; un appui relance la synchro. */
export function SyncBadge() {
  const e = engine.value;
  if (!e) return null;
  const st = e.status.value;
  const last = e.lastSyncAt.value;
  const title = [
    e.error.value,
    last ? `Dernière synchro ${relativeTime(last)}` : null,
    e.hasPendingChanges ? 'Des modifications attendent d’être envoyées' : null,
    'Appuyer pour synchroniser maintenant',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <button class={`sync s-${st}`} onClick={() => void e.sync()} title={title} aria-label={`${LABELS[st]}. ${title}`}>
      <span class="dot" aria-hidden="true" />
      {LABELS[st]}
    </button>
  );
}
