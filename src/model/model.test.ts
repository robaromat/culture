import { describe, expect, it } from 'vitest';
import { addItem, createTag, deleteTag, mergeTags, setStatus, updateItem, type ItemDraft } from './ops';
import { filterItems, sortItems, type Filters } from './filter';
import type { DataFile } from './types';

const draft = (over: Partial<ItemDraft> = {}): ItemDraft => ({
  category: 'film', title: 'Sans titre', creator: '', year: null, cover: null, status: 'a_decouvrir', rating: 0,
  tags: [], notes: '', link: null, source: { provider: 'manual', id: null, subtype: null }, recommendedBy: '', ...over,
});
const empty: DataFile = { schemaVersion: 1, tags: [], items: [] };
const all: Filters = { category: 'all', status: 'all', tags: [], query: '', onlyProviders: null };

describe('opérations', () => {
  it('ajoute une fiche en tête avec des dates', () => {
    const { data, id } = addItem(empty, draft({ title: 'Yoga' }));
    expect(data.items[0]?.id).toBe(id);
    expect(data.items[0]?.addedAt).toBeTruthy();
    expect(data.items[0]?.finishedAt).toBeNull();
    expect(empty.items).toHaveLength(0); // pas de modification en place
  });

  it('renseigne puis efface la date de fin selon le statut', () => {
    const { data, id } = addItem(empty, draft());
    const done = setStatus(data, id, 'termine');
    expect(done.items[0]?.finishedAt).toBeTruthy();
    const back = setStatus(done, id, 'a_decouvrir');
    expect(back.items[0]?.finishedAt).toBeNull();
  });

  it("ne crée pas deux tags de même nom (casse ignorée)", () => {
    const a = createTag(empty, 'Comédie', '#000000');
    const b = createTag(a.data, ' comédie ', '#ffffff');
    expect(b.data.tags).toHaveLength(1);
    expect(b.tag.id).toBe(a.tag.id);
  });

  it('fusionne deux tags sans doublon sur une fiche', () => {
    let d = createTag(empty, 'drôle', '#000').data;
    d = createTag(d, 'comédie', '#000').data;
    const [drole, comedie] = d.tags;
    d = addItem(d, draft({ tags: [drole!.id, comedie!.id] })).data;
    d = mergeTags(d, drole!.id, comedie!.id);
    expect(d.tags.map((t) => t.name)).toEqual(['comédie']);
    expect(d.items[0]?.tags).toEqual([comedie!.id]);
  });

  it('supprime un tag partout', () => {
    let d = createTag(empty, 'x', '#000').data;
    const id = d.tags[0]!.id;
    d = addItem(d, draft({ tags: [id] })).data;
    d = deleteTag(d, id);
    expect(d.tags).toHaveLength(0);
    expect(d.items[0]?.tags).toEqual([]);
  });

  it('met à jour updatedAt', async () => {
    const { data, id } = addItem(empty, draft());
    await new Promise((r) => setTimeout(r, 5));
    const u = updateItem(data, id, { notes: 'x' });
    expect(u.items[0]!.updatedAt > data.items[0]!.updatedAt).toBe(true);
  });
});

describe('filtres et tri', () => {
  let d = empty;
  d = addItem(d, draft({ title: 'Yoga', creator: 'Emmanuel Carrère', category: 'livre', tags: ['a'] })).data;
  d = addItem(d, draft({ title: 'Perfect Days', year: 2023, status: 'termine', rating: 5, tags: ['a', 'b'], availability: { providers: ['prime'], checkedAt: '' } })).data;
  d = addItem(d, draft({ title: 'Anatomie d’une chute', year: 2023, tags: ['b'], availability: { providers: ['netflix'], checkedAt: '' } })).data;

  it('recherche sans accents', () => {
    expect(filterItems(d.items, { ...all, query: 'carrere' }).map((i) => i.title)).toEqual(['Yoga']);
  });
  it('combine les tags en ET', () => {
    expect(filterItems(d.items, { ...all, tags: ['a', 'b'] }).map((i) => i.title)).toEqual(['Perfect Days']);
  });
  it('filtre statut et catégorie', () => {
    expect(filterItems(d.items, { ...all, status: 'a_decouvrir', category: 'film' }).map((i) => i.title)).toEqual(['Anatomie d’une chute']);
  });
  it('filtre sur mes abonnements', () => {
    expect(filterItems(d.items, { ...all, onlyProviders: ['netflix'] }).map((i) => i.title)).toEqual(['Anatomie d’une chute']);
  });
  it('trie par titre à la française', () => {
    expect(sortItems(d.items, 'title').map((i) => i.title)).toEqual(['Anatomie d’une chute', 'Perfect Days', 'Yoga']);
  });
  it('trie par note puis date', () => {
    expect(sortItems(d.items, 'rating')[0]?.title).toBe('Perfect Days');
  });
});
