import { describe, expect, it } from 'vitest';
import { mergeData } from './merge';
import type { DataFile, Item, Tag } from '../model/types';

const tag = (id: string, name = id): Tag => ({ id, name, color: '#000000' });
const item = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  category: 'film',
  title: id,
  creator: '',
  year: null,
  cover: null,
  status: 'a_decouvrir',
  rating: 0,
  tags: [],
  notes: '',
  link: null,
  source: { provider: 'manual', id: null, subtype: null },
  recommendedBy: '',
  addedAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  finishedAt: null,
  ...over,
});
const file = (items: Item[], tags: Tag[] = []): DataFile => ({ schemaVersion: 1, tags, items });
const ids = (d: DataFile) => d.items.map((i) => i.id).sort();

describe('mergeData', () => {
  it('garde les ajouts faits des deux côtés', () => {
    const base = file([item('a')]);
    const local = file([item('a'), item('b')]);
    const remote = file([item('a'), item('c')]);
    expect(ids(mergeData(base, local, remote))).toEqual(['a', 'b', 'c']);
  });

  it("ne ressuscite pas une fiche supprimée ici et inchangée là-bas", () => {
    const base = file([item('a'), item('b')]);
    const local = file([item('a')]);
    const remote = file([item('a'), item('b'), item('c')]);
    expect(ids(mergeData(base, local, remote))).toEqual(['a', 'c']);
  });

  it('applique une suppression faite là-bas', () => {
    const base = file([item('a'), item('b')]);
    const local = file([item('a'), item('b'), item('d')]);
    const remote = file([item('a')]);
    expect(ids(mergeData(base, local, remote))).toEqual(['a', 'd']);
  });

  it('garde une fiche supprimée là-bas mais modifiée ici', () => {
    const base = file([item('a')]);
    const local = file([item('a', { notes: 'modifié', updatedAt: '2026-11-02T00:00:00Z' })]);
    const remote = file([]);
    expect(mergeData(base, local, remote).items[0]?.notes).toBe('modifié');
  });

  it('prend la modification du seul côté qui a changé', () => {
    const base = file([item('a')]);
    const local = file([item('a')]);
    const remote = file([item('a', { status: 'termine', updatedAt: '2026-11-03T00:00:00Z' })]);
    expect(mergeData(base, local, remote).items[0]?.status).toBe('termine');
  });

  it('les deux ont modifié : la plus récente gagne', () => {
    const base = file([item('a')]);
    const local = file([item('a', { notes: 'ici', updatedAt: '2026-11-05T00:00:00Z' })]);
    const remote = file([item('a', { notes: 'là-bas', updatedAt: '2026-11-04T00:00:00Z' })]);
    expect(mergeData(base, local, remote).items[0]?.notes).toBe('ici');
    const remote2 = file([item('a', { notes: 'là-bas', updatedAt: '2026-11-06T00:00:00Z' })]);
    expect(mergeData(base, local, remote2).items[0]?.notes).toBe('là-bas');
  });

  it('retire des fiches un tag supprimé sur un autre appareil', () => {
    const base = file([item('a', { tags: ['t1', 't2'] })], [tag('t1'), tag('t2')]);
    const local = file([item('a', { tags: ['t1', 't2'] }), item('b', { tags: ['t2'] })], [tag('t1'), tag('t2')]);
    const remote = file([item('a', { tags: ['t1'], updatedAt: '2026-11-02T00:00:00Z' })], [tag('t1')]);
    const m = mergeData(base, local, remote);
    expect(m.tags.map((t) => t.id)).toEqual(['t1']);
    expect(m.items.find((i) => i.id === 'b')?.tags).toEqual([]);
  });

  it('sans base (premier envoi) : union des deux', () => {
    expect(ids(mergeData(null, file([item('a')]), file([item('b')])))).toEqual(['a', 'b']);
  });
});
