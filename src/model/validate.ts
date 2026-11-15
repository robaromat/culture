import type { DataFile } from './types';

/** Vérification minimale de data.json (lu sur GitHub ou importé). Renvoie null si le format ne colle pas. */
export function parseDataFile(raw: unknown): DataFile | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 1 || !Array.isArray(o.tags) || !Array.isArray(o.items)) return null;
  const okTags = o.tags.every((t) => t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'string');
  const okItems = o.items.every(
    (i) =>
      i &&
      typeof i === 'object' &&
      typeof (i as { id?: unknown }).id === 'string' &&
      typeof (i as { title?: unknown }).title === 'string',
  );
  return okTags && okItems ? (raw as DataFile) : null;
}

export function emptyDataFile(): DataFile {
  return { schemaVersion: 1, tags: [], items: [] };
}
