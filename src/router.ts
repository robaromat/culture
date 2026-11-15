import { signal } from '@preact/signals';
import type { Category } from './model/types';

// Navigation par #/… : GitHub Pages ne sait pas renvoyer /culture/reglages vers l'app, le hash si.
// Chaque écran a sa propre adresse, donc le bouton Retour d'Android ferme une fiche au lieu de quitter l'app.

export type Route =
  | { name: 'library' }
  | { name: 'item'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'add' }
  | { name: 'addForm'; category: Category }
  | { name: 'tags' }
  | { name: 'settings' };

const CATS: Category[] = ['livre', 'film', 'serie', 'musique', 'podcast', 'autre'];

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (a === 'fiche' && b) return c === 'modifier' ? { name: 'edit', id: b } : { name: 'item', id: b };
  if (a === 'ajouter') return b && (CATS as string[]).includes(b) ? { name: 'addForm', category: b as Category } : { name: 'add' };
  if (a === 'tags') return { name: 'tags' };
  if (a === 'reglages') return { name: 'settings' };
  return { name: 'library' };
}

export function hrefOf(r: Route): string {
  switch (r.name) {
    case 'library': return '#/';
    case 'item': return `#/fiche/${encodeURIComponent(r.id)}`;
    case 'edit': return `#/fiche/${encodeURIComponent(r.id)}/modifier`;
    case 'add': return '#/ajouter';
    case 'addForm': return `#/ajouter/${r.category}`;
    case 'tags': return '#/tags';
    case 'settings': return '#/reglages';
  }
}

/** Raccourci pour les quatre entrées de la navigation. */
export const hrefFor = (name: 'library' | 'add' | 'tags' | 'settings') => hrefOf({ name } as Route);

export const route = signal<Route>(parseHash(location.hash));
// Adresse de l'écran précédent, pour savoir si « Retour » ramène bien là où on veut aller.
let previousHref: string | null = null;
window.addEventListener('hashchange', (e) => {
  previousHref = normalize(new URL(e.oldURL).hash);
  route.value = parseHash(location.hash);
});
const normalize = (h: string) => hrefOf(parseHash(h));

/** `replace` : remplace l'entrée d'historique (ex. après « Enregistrer », Retour ne rouvre pas le formulaire). */
export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const h = hrefOf(r);
  if (opts.replace) {
    history.replaceState(null, '', h);
    route.value = parseHash(h);
  } else location.hash = h;
}

/**
 * Aller à `target` en reculant dans l'historique si l'écran précédent est justement celui-là
 * (le bouton Retour d'Android reste cohérent), sinon en remplaçant l'écran courant
 * (ouvert depuis un favori : on ne quitte pas l'app).
 */
export function back(target: Route): void {
  if (previousHref === hrefOf(target)) history.back();
  else navigate(target, { replace: true });
}
