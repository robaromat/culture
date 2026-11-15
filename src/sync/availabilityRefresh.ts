import { engine, mutate } from './store';
import { settings } from '../settings/settings';
import { fetchAvailability } from '../providers/tmdb';
import { isStale } from '../providers/availability';
import { ProviderError } from '../providers/types';
import type { Availability, Item } from '../model/types';

// Disponibilité Netflix / Prime / Canal+ : vérifiée à l'ajout, puis revérifiée automatiquement à l'ouverture
// de l'app pour les films et séries « À voir » dont la dernière vérification date de plus de 7 jours.
//
// Le rafraîchissement ne change pas updatedAt : si l'autre appareil modifie la fiche en même temps
// (notes, tags…), c'est sa modification qui gagne à la fusion, pas ce simple rafraîchissement.

const MAX_PER_RUN = 40;
let ranThisSession = false;

const kindOf = (i: Item) => (i.category === 'film' ? 'movie' : 'tv') as 'movie' | 'tv';
const eligible = (i: Item) => (i.category === 'film' || i.category === 'serie') && i.source.provider === 'tmdb' && !!i.source.id;

function apply(updates: Map<string, Availability>) {
  if (!updates.size) return;
  mutate((d) => ({ ...d, items: d.items.map((i) => (updates.has(i.id) ? { ...i, availability: updates.get(i.id)! } : i)) }));
}

export async function refreshStaleAvailability(): Promise<void> {
  if (ranThisSession) return;
  ranThisSession = true;
  const d = engine.value?.data.value;
  if (!d || !settings.value.tmdbKey) return;
  const stale = d.items.filter((i) => eligible(i) && i.status !== 'termine' && isStale(i.availability?.checkedAt)).slice(0, MAX_PER_RUN);
  const updates = new Map<string, Availability>();
  for (const i of stale) {
    try {
      updates.set(i.id, await fetchAvailability(kindOf(i), i.source.id!));
    } catch (e) {
      if (e instanceof ProviderError && /Clé|connexion/i.test(e.message)) break; // inutile d'insister
    }
    await new Promise((r) => setTimeout(r, 120)); // reste poli avec l'API
  }
  apply(updates); // un seul enregistrement (un seul commit) pour tout le lot
}

/** Bouton « Vérifier maintenant » d'une fiche. */
export async function checkAvailabilityNow(item: Item): Promise<void> {
  if (!eligible(item)) throw new ProviderError('Cette fiche ne vient pas de TMDB : rien à vérifier.');
  if (!settings.value.tmdbKey) throw new ProviderError('Ajoute ta clé TMDB dans Réglages.');
  apply(new Map([[item.id, await fetchAvailability(kindOf(item), item.source.id!)]]));
}
