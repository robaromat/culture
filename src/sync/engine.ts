import { signal } from '@preact/signals';
import type { DataFile } from '../model/types';
import { GitHubError, type RemoteFile } from './github';
import { mergeData } from './merge';

// Moteur de synchronisation : l'app travaille toujours sur la copie locale (affichage immédiat, hors connexion),
// et le moteur la rapproche de GitHub en arrière-plan.
//
//   modifier → copie locale + IndexedDB, marquée « en attente » → envoi groupé ~1 s plus tard
//   envoi refusé (409/422) → relire GitHub, fusionner (merge.ts), renvoyer
//   pas de réseau → reste « en attente », renvoyé au retour du réseau (événement online, retour sur l'app…)

export type SyncStatus = 'loading' | 'ok' | 'pending' | 'syncing' | 'offline' | 'error';

export interface EngineDeps {
  read: () => Promise<RemoteFile>;
  write: (data: DataFile, sha: string | null, message: string) => Promise<string>;
  load: () => Promise<PersistedState | undefined>;
  save: (s: PersistedState) => Promise<void>;
  pushDelayMs?: number;
}

export interface PersistedState {
  local: DataFile | null;
  base: RemoteFile | null;
  dirty: boolean;
  lastSyncAt: string | null;
}

const MAX_ATTEMPTS = 5;

export function createSyncEngine(deps: EngineDeps) {
  const data = signal<DataFile | null>(null);
  const status = signal<SyncStatus>('loading');
  const error = signal<string | null>(null);
  const lastSyncAt = signal<string | null>(null);

  let base: RemoteFile | null = null;
  let dirty = false;
  let queue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let editsSinceSend = 0;

  const persist = () => deps.save({ local: data.value, base, dirty, lastSyncAt: lastSyncAt.value });

  /** Exécute les opérations réseau une par une, jamais en parallèle. */
  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task, task);
    return queue;
  }

  async function adoptRemote(r: RemoteFile) {
    if (dirty && data.value) data.value = mergeData(base?.data ?? null, data.value, r.data);
    else data.value = r.data;
    base = r;
  }

  async function pushLoop() {
    for (let attempt = 0; dirty && attempt < MAX_ATTEMPTS; attempt++) {
      if (!base) await adoptRemote(await deps.read());
      const sending = data.value;
      if (!sending || !base) return;
      const editsBefore = editsSinceSend;
      try {
        const n = sending.items.length;
        const sha = await deps.write(sending, base.sha, `Mise à jour depuis l'app (${n} fiche${n > 1 ? 's' : ''})`);
        base = { data: sending, sha };
        if (editsSinceSend === editsBefore) dirty = false;
      } catch (e) {
        if (e instanceof GitHubError && e.kind === 'conflict') {
          await adoptRemote(await deps.read());
          continue;
        }
        throw e;
      }
    }
  }

  function sync(): Promise<void> {
    clearTimeout(timer);
    return enqueue(async () => {
      if (!data.value) status.value = 'loading';
      else status.value = 'syncing';
      try {
        if (!dirty) await adoptRemote(await deps.read());
        await pushLoop();
        lastSyncAt.value = new Date().toISOString();
        error.value = null;
        status.value = dirty ? 'pending' : 'ok';
      } catch (e) {
        const ge = e instanceof GitHubError ? e : new GitHubError('server', String(e));
        if (ge.kind === 'network') {
          status.value = dirty ? 'offline' : data.value ? 'offline' : 'error';
          error.value = data.value ? null : ge.message;
        } else {
          status.value = 'error';
          error.value = ge.message;
        }
      }
      await persist();
    });
  }

  async function init(): Promise<void> {
    const s = await deps.load();
    if (s) {
      data.value = s.local ?? s.base?.data ?? null;
      base = s.base;
      dirty = s.dirty;
      lastSyncAt.value = s.lastSyncAt;
      if (data.value) status.value = dirty ? 'pending' : 'ok';
    }
    await sync();
  }

  /** Modifie les données. `fn` reçoit l'état courant et renvoie le nouvel état (sans muter l'ancien). */
  function mutate(fn: (d: DataFile) => DataFile): void {
    if (!data.value) return;
    data.value = fn(data.value);
    dirty = true;
    editsSinceSend++;
    if (status.value !== 'error') status.value = 'pending';
    void persist();
    clearTimeout(timer);
    timer = setTimeout(() => void sync(), deps.pushDelayMs ?? 1000);
  }

  return {
    data,
    status,
    error,
    lastSyncAt,
    init,
    sync,
    mutate,
    get hasPendingChanges() {
      return dirty;
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
