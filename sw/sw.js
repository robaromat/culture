/* Service worker de Culture : app consultable hors connexion.
 * Généré au build : vite.config.ts y injecte le numéro de version et la liste des fichiers de l'app.
 *  - coquille de l'app (HTML, JS, CSS, icônes) : en cache à l'installation, servie même sans réseau ;
 *  - polices Google : servies du cache puis rafraîchies ;
 *  - couvertures (Open Library, TMDB, Spotify) : gardées en cache une fois vues ;
 *  - API (GitHub, TMDB, Spotify, recherche Open Library) : jamais mises en cache (données et jetons privés).
 * Les données elles-mêmes vivent dans IndexedDB, gérées par l'app.
 */
const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const SHELL = `culture-shell-${VERSION}`;
const FONTS = 'culture-fonts';
const IMAGES = 'culture-images';
const MAX_IMAGES = 800;
const IMAGE_HOSTS = [/(^|\.)covers\.openlibrary\.org$/, /(^|\.)archive\.org$/, /(^|\.)image\.tmdb\.org$/, /(^|\.)scdn\.co$/, /(^|\.)spotifycdn\.com$/];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const scopeUrl = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE.map(scopeUrl))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('culture-shell-') && k !== SHELL) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// L'app demande d'activer la nouvelle version quand tu touches « Mettre à jour ».
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trimImages() {
  const c = await caches.open(IMAGES);
  const keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await c.delete(k);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Pages de l'app : réseau d'abord (pour avoir la dernière version), cache si hors ligne.
  if (req.mode === 'navigate' && url.origin === self.location.origin && url.href.startsWith(self.registration.scope)) {
    event.respondWith(
      (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(req, { signal: ctrl.signal });
          clearTimeout(t);
          return res;
        } catch {
          return (await caches.match(scopeUrl('./'), { ignoreSearch: true })) || Response.error();
        }
      })(),
    );
    return;
  }

  // Fichiers de l'app (noms avec empreinte) : cache d'abord.
  if (url.origin === self.location.origin && url.href.startsWith(self.registration.scope)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Polices : cache, puis mise à jour en arrière-plan.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      (async () => {
        const c = await caches.open(FONTS);
        const hit = await c.match(req);
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })(),
    );
    return;
  }

  // Couvertures : cache d'abord, gardées pour la consultation hors connexion.
  if (req.destination === 'image' && IMAGE_HOSTS.some((h) => h.test(url.hostname))) {
    event.respondWith(
      (async () => {
        const c = await caches.open(IMAGES);
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) {
            await c.put(req, res.clone());
            event.waitUntil(trimImages());
          }
          return res;
        } catch {
          return Response.error();
        }
      })(),
    );
  }
  // Tout le reste (API) : comportement normal du navigateur, rien en cache.
});
