import { signal } from '@preact/signals';
import { createSyncEngine, type PersistedState, type SyncEngine } from './engine';
import { readDataFile, writeDataFile } from './github';
import { idbClear, idbGet, idbSet } from './idb';
import { repoRef, settings } from '../settings/settings';
import type { DataFile } from '../model/types';

// L'instance de synchro de l'app, branchée sur les réglages de l'appareil et sur IndexedDB.

const STATE_KEY = 'sync-state';

export const engine = signal<SyncEngine | null>(null);

/** (Re)démarre la synchro avec les réglages actuels (au lancement, ou après changement de jeton/dépôt). */
export function startSync(): Promise<void> {
  const ref = repoRef(settings.value);
  const key = `${STATE_KEY}:${ref.owner}/${ref.repo}`;
  const e = createSyncEngine({
    read: () => readDataFile(repoRef()),
    write: (d, sha, msg) => writeDataFile(repoRef(), d, sha, msg),
    load: () => idbGet<PersistedState>(key),
    save: (s) => idbSet(key, s),
  });
  engine.value = e;
  return e.init();
}

/** Raccourci pour les écrans : modifier les données. */
export function mutate(fn: (d: DataFile) => DataFile): void {
  engine.value?.mutate(fn);
}

/** Oublie le cache local (déconnexion de l'appareil). */
export async function resetLocal(): Promise<void> {
  engine.value = null;
  await idbClear();
}

let listening = false;
let lastFocusSync = 0;

/** Resynchronise au retour du réseau, au retour sur l'app, et réessaie régulièrement s'il reste des modifs. */
export function installSyncTriggers(): void {
  if (listening) return;
  listening = true;
  window.addEventListener('online', () => void engine.value?.sync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastFocusSync < 20_000) return;
    lastFocusSync = now;
    void engine.value?.sync();
  });
  setInterval(() => {
    const e = engine.value;
    if (e?.hasPendingChanges && navigator.onLine) void e.sync();
  }, 60_000);
}
