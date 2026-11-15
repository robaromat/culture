import { signal } from '@preact/signals';
import { engine, mutate } from '../sync/store';
import { settings } from '../settings/settings';
import { findByImdb, tmdbDraft } from '../providers/tmdb';
import { ProviderError } from '../providers/types';
import type { Item } from '../model/types';

// Complète les fiches importées d'IMDb grâce à TMDB : affiche, lien TMDB, réalisateur manquant, disponibilité.
// Le titre reste celui de ta liste IMDb. updatedAt n'est pas modifié (ce n'est pas une modification de ta part).
// Enregistré par lots pour limiter le nombre de commits.

export const enrichState = signal<{ running: boolean; done: number; total: number; failed: number; error: string | null }>({
  running: false, done: 0, total: 0, failed: 0, error: null,
});

export const needsEnrichment = (i: Item) => (i.category === 'film' || i.category === 'serie') && !!i.source.imdbId && i.source.provider === 'imdb';

const BATCH = 25;

export async function enrichImported(): Promise<void> {
  if (enrichState.value.running) return;
  const d = engine.value?.data.value;
  if (!d) return;
  if (!settings.value.tmdbKey) {
    enrichState.value = { ...enrichState.value, error: 'Ajoute ta clé TMDB dans Réglages pour récupérer affiches et disponibilités.' };
    return;
  }
  const todo = d.items.filter(needsEnrichment);
  enrichState.value = { running: true, done: 0, total: todo.length, failed: 0, error: null };
  let pending = new Map<string, Partial<Item>>();
  const flush = () => {
    if (!pending.size) return;
    const p = pending;
    pending = new Map();
    mutate((data) => ({ ...data, items: data.items.map((i) => (p.has(i.id) ? { ...i, ...p.get(i.id) } : i)) }));
  };
  let failed = 0;
  for (const [n, item] of todo.entries()) {
    try {
      const found = await findByImdb(item.source.imdbId!);
      if (found) {
        const t = await tmdbDraft(found.kind, found.id);
        pending.set(item.id, {
          cover: t.cover ?? item.cover,
          link: t.link ?? item.link,
          creator: item.creator || t.creator || '',
          year: item.year ?? t.year ?? null,
          category: found.kind === 'tv' ? 'serie' : item.category === 'serie' ? 'serie' : 'film',
          source: { provider: 'tmdb', id: t.source?.id ?? String(found.id), subtype: null, imdbId: item.source.imdbId },
          availability: t.availability,
        });
      } else {
        failed++;
      }
    } catch (e) {
      if (e instanceof ProviderError && /Clé|connexion/i.test(e.message)) {
        flush();
        enrichState.value = { ...enrichState.value, running: false, error: e.message };
        return;
      }
      failed++;
    }
    enrichState.value = { running: true, done: n + 1, total: todo.length, failed, error: null };
    if (pending.size >= BATCH) flush();
    await new Promise((r) => setTimeout(r, 60));
  }
  flush();
  enrichState.value = { running: false, done: todo.length, total: todo.length, failed, error: null };
}
