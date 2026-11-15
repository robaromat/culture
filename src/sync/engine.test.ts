import { describe, expect, it } from 'vitest';
import { createSyncEngine, type PersistedState } from './engine';
import { GitHubError } from './github';
import type { DataFile, Item } from '../model/types';

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, category: 'film', title: id, creator: '', year: null, cover: null, status: 'a_decouvrir', rating: 0,
  tags: [], notes: '', link: null, source: { provider: 'manual', id: null, subtype: null }, recommendedBy: '',
  addedAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', finishedAt: null, ...over,
});
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Faux dépôt GitHub : un fichier + un sha qui change à chaque écriture, refus si le sha envoyé est périmé. */
function fakeRemote(initial: DataFile) {
  let file = clone(initial);
  let sha = 1;
  let online = true;
  return {
    read: async () => {
      if (!online) throw new GitHubError('network', 'hors ligne');
      return { data: clone(file), sha: String(sha) };
    },
    write: async (d: DataFile, s: string | null) => {
      if (!online) throw new GitHubError('network', 'hors ligne');
      if (s !== String(sha)) throw new GitHubError('conflict', 'conflit', 409);
      file = clone(d);
      sha++;
      return String(sha);
    },
    /** Écriture faite par « l'autre appareil ». */
    otherDevice: (fn: (d: DataFile) => DataFile) => {
      file = fn(clone(file));
      sha++;
    },
    get file() { return file; },
    setOnline: (v: boolean) => { online = v; },
  };
}

function engineFor(remote: ReturnType<typeof fakeRemote>) {
  let stored: PersistedState | undefined;
  return createSyncEngine({
    read: remote.read,
    write: remote.write,
    load: async () => stored,
    save: async (s) => { stored = clone(s); },
    pushDelayMs: 1_000_000, // on déclenche sync() à la main dans les tests
  });
}

const start: DataFile = { schemaVersion: 1, tags: [], items: [item('a')] };

describe('moteur de synchro', () => {
  it('charge le fichier distant au démarrage', async () => {
    const remote = fakeRemote(start);
    const e = engineFor(remote);
    await e.init();
    expect(e.status.value).toBe('ok');
    expect(e.data.value?.items.map((i) => i.id)).toEqual(['a']);
  });

  it("envoie une modification locale", async () => {
    const remote = fakeRemote(start);
    const e = engineFor(remote);
    await e.init();
    e.mutate((d) => ({ ...d, items: [...d.items, item('b')] }));
    expect(e.status.value).toBe('pending');
    await e.sync();
    expect(e.status.value).toBe('ok');
    expect(remote.file.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it("fusionne quand l'autre appareil a écrit entre-temps (409)", async () => {
    const remote = fakeRemote(start);
    const e = engineFor(remote);
    await e.init();
    remote.otherDevice((d) => ({ ...d, items: [...d.items, item('autre')] }));
    e.mutate((d) => ({ ...d, items: [...d.items, item('ici')] }));
    await e.sync();
    expect(e.status.value).toBe('ok');
    expect(remote.file.items.map((i) => i.id).sort()).toEqual(['a', 'autre', 'ici']);
    expect(e.data.value?.items.map((i) => i.id).sort()).toEqual(['a', 'autre', 'ici']);
  });

  it('garde les modifications hors ligne et les envoie au retour du réseau', async () => {
    const remote = fakeRemote(start);
    const e = engineFor(remote);
    await e.init();
    remote.setOnline(false);
    e.mutate((d) => ({ ...d, items: [...d.items, item('metro')] }));
    await e.sync();
    expect(e.status.value).toBe('offline');
    expect(e.hasPendingChanges).toBe(true);
    remote.setOnline(true);
    await e.sync();
    expect(e.status.value).toBe('ok');
    expect(remote.file.items.map((i) => i.id)).toEqual(['a', 'metro']);
  });

  it("récupère au démarrage d'une modification restée en attente (app fermée hors ligne)", async () => {
    const remote = fakeRemote(start);
    let stored: PersistedState | undefined;
    const mk = () => createSyncEngine({
      read: remote.read, write: remote.write,
      load: async () => stored, save: async (s) => { stored = clone(s); }, pushDelayMs: 1_000_000,
    });
    const e1 = mk();
    await e1.init();
    remote.setOnline(false);
    e1.mutate((d) => ({ ...d, items: [...d.items, item('oubliee')] }));
    await e1.sync();
    remote.setOnline(true);
    const e2 = mk(); // relance de l'app
    await e2.init();
    expect(remote.file.items.map((i) => i.id)).toEqual(['a', 'oubliee']);
    expect(e2.status.value).toBe('ok');
  });

  it("signale clairement un jeton refusé", async () => {
    const remote = fakeRemote(start);
    const e = createSyncEngine({
      read: async () => { throw new GitHubError('auth', 'Jeton GitHub refusé', 401); },
      write: remote.write, load: async () => undefined, save: async () => {},
    });
    await e.init();
    expect(e.status.value).toBe('error');
    expect(e.error.value).toContain('Jeton');
  });
});
