import { signal } from '@preact/signals';

// Navigation par #/… : GitHub Pages ne sait pas renvoyer /culture/reglages vers l'app, le hash si.

export type Route = 'library' | 'add' | 'tags' | 'settings';

const PATHS: Record<Route, string> = { library: '', add: 'ajouter', tags: 'tags', settings: 'reglages' };

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const found = (Object.entries(PATHS) as [Route, string][]).find(([, p]) => p === h);
  return found ? found[0] : 'library';
}

export const route = signal<Route>(parse());
window.addEventListener('hashchange', () => (route.value = parse()));

export const hrefFor = (r: Route) => `#/${PATHS[r]}`;

export function navigate(r: Route): void {
  location.hash = hrefFor(r);
}
