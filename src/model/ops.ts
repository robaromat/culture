import type { DataFile, Item, Status, Tag } from './types';
import { newId } from '../lib/ids';

// Opérations pures sur data.json : chacune renvoie un nouvel objet (rien n'est modifié en place),
// ce qui permet au moteur de synchro de comparer et fusionner proprement.

const now = () => new Date().toISOString();

export type ItemDraft = Omit<Item, 'id' | 'addedAt' | 'updatedAt' | 'finishedAt'> & { finishedAt?: string | null };

export function addItem(d: DataFile, draft: ItemDraft): { data: DataFile; id: string } {
  const t = now();
  const item: Item = {
    ...draft,
    id: newId('i'),
    addedAt: t,
    updatedAt: t,
    finishedAt: draft.status === 'termine' ? (draft.finishedAt ?? t) : null,
  };
  return { data: { ...d, items: [item, ...d.items] }, id: item.id };
}

export function updateItem(d: DataFile, id: string, patch: Partial<Omit<Item, 'id' | 'addedAt'>>): DataFile {
  return {
    ...d,
    items: d.items.map((i) => {
      if (i.id !== id) return i;
      const next = { ...i, ...patch, updatedAt: now() };
      if (patch.status && patch.status !== i.status) next.finishedAt = patch.status === 'termine' ? now() : null;
      return next;
    }),
  };
}

export const setStatus = (d: DataFile, id: string, status: Status) => updateItem(d, id, { status });

export function deleteItem(d: DataFile, id: string): DataFile {
  return { ...d, items: d.items.filter((i) => i.id !== id) };
}

export function createTag(d: DataFile, name: string, color: string): { data: DataFile; tag: Tag } {
  const clean = name.trim();
  const existing = d.tags.find((t) => t.name.toLocaleLowerCase('fr') === clean.toLocaleLowerCase('fr'));
  if (existing) return { data: d, tag: existing };
  const tag: Tag = { id: newId('t'), name: clean, color };
  return { data: { ...d, tags: [...d.tags, tag] }, tag };
}

export function updateTag(d: DataFile, id: string, patch: Partial<Omit<Tag, 'id'>>): DataFile {
  return { ...d, tags: d.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
}

/** Retire le tag de toutes les fiches (qui sont alors marquées modifiées) puis le supprime. */
export function deleteTag(d: DataFile, id: string): DataFile {
  const t = now();
  return {
    ...d,
    tags: d.tags.filter((x) => x.id !== id),
    items: d.items.map((i) => (i.tags.includes(id) ? { ...i, tags: i.tags.filter((x) => x !== id), updatedAt: t } : i)),
  };
}

/** Fusionne `fromId` dans `intoId` : les fiches portant `fromId` portent désormais `intoId`, sans doublon. */
export function mergeTags(d: DataFile, fromId: string, intoId: string): DataFile {
  if (fromId === intoId) return d;
  const t = now();
  return {
    ...d,
    tags: d.tags.filter((x) => x.id !== fromId),
    items: d.items.map((i) =>
      i.tags.includes(fromId) ? { ...i, tags: [...new Set(i.tags.map((x) => (x === fromId ? intoId : x)))], updatedAt: t } : i,
    ),
  };
}

export const TAG_COLORS = ['#74303A', '#B8862B', '#3F6B55', '#3E5A7A', '#8A5A9B', '#B4583E', '#5C6B2E', '#2E7A7A', '#7A6A5A'];
