import { signal } from '@preact/signals';
import { settings } from '../settings/settings';
import { ProviderError, yearOf, type SearchResult } from './types';
import type { SpotifySubtype } from '../model/types';
import type { ItemDraft } from '../model/ops';

// Spotify, deux modes :
//  B) lien collé → endpoint public oEmbed (titre + image), sans compte développeur. Toujours disponible.
//  A) recherche intégrée → connexion « Authorization Code with PKCE » (pas de secret côté navigateur),
//     puis /v1/search. Jetons gardés dans le stockage local de l'appareil.

const OPEN = 'https://open.spotify.com';
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
const TOKENS_KEY = 'culture.spotify.tokens.v1';
const PKCE_KEY = 'culture.spotify.pkce';

const SUBTYPES: SpotifySubtype[] = ['album', 'track', 'artist', 'show', 'episode'];
export const isPodcastType = (t: SpotifySubtype) => t === 'show' || t === 'episode';

/** Reconnaît open.spotify.com/(intl-fr/)album/ID, spotify:album:ID… */
export function parseSpotifyUrl(raw: string): { type: SpotifySubtype; id: string; url: string } | null {
  const s = raw.trim();
  const uri = s.match(/^spotify:(album|track|artist|show|episode):([A-Za-z0-9]+)$/);
  if (uri) return { type: uri[1] as SpotifySubtype, id: uri[2]!, url: `${OPEN}/${uri[1]}/${uri[2]}` };
  try {
    const u = new URL(s);
    if (u.hostname !== 'open.spotify.com') return null;
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
    if (!m) return null;
    return { type: m[1] as SpotifySubtype, id: m[2]!, url: `${OPEN}/${m[1]}/${m[2]}` };
  } catch {
    return null;
  }
}

/** Mode B : un lien Spotify collé (open.spotify.com ou lien court spotify.link). */
export async function spotifyFromLink(raw: string): Promise<SearchResult | null> {
  const parsed = parseSpotifyUrl(raw);
  const isShort = /^https?:\/\/(spotify\.link|spoti\.fi)\//.test(raw.trim());
  if (!parsed && !isShort) return null;
  // Connecté : l'API donne aussi l'artiste et l'année.
  if (parsed && spotifyConnected.value) {
    try {
      const item = await api<SpotifyObject>(`/${parsed.type}s/${parsed.id}`, { market: 'FR' });
      return toResult(parsed.type, item);
    } catch {
      /* on retombe sur oEmbed */
    }
  }
  const target = parsed?.url ?? raw.trim();
  let res: Response;
  try {
    res = await fetch(`${OPEN}/oembed?url=${encodeURIComponent(target)}`);
  } catch {
    throw new ProviderError('Pas de connexion à Spotify.');
  }
  if (!res.ok) throw new ProviderError('Spotify ne reconnaît pas ce lien.');
  const o = (await res.json()) as { title: string; thumbnail_url?: string; iframe_url?: string };
  // Lien court : le type et l'id se lisent dans l'adresse du lecteur intégré.
  const fromIframe = o.iframe_url ? o.iframe_url.match(/\/embed\/(album|track|artist|show|episode)\/([A-Za-z0-9]+)/) : null;
  const type = parsed?.type ?? (fromIframe?.[1] as SpotifySubtype | undefined) ?? 'album';
  const id = parsed?.id ?? fromIframe?.[2] ?? null;
  const url = id ? `${OPEN}/${type}/${id}` : target;
  const draft: Partial<ItemDraft> = {
    category: isPodcastType(type) ? 'podcast' : 'musique',
    title: o.title,
    creator: '',
    year: null,
    cover: o.thumbnail_url ?? null,
    link: url,
    source: { provider: 'spotify', id, subtype: type },
  };
  return {
    key: `sp:${type}:${id ?? url}`,
    category: draft.category!,
    title: o.title,
    creator: '',
    year: null,
    cover: o.thumbnail_url ?? null,
    kind: KIND_LABEL[type],
    sourceId: id ?? url,
    resolve: async () => draft,
  };
}

export const KIND_LABEL: Record<SpotifySubtype, string> = { album: 'Album', track: 'Titre', artist: 'Artiste', show: 'Émission', episode: 'Épisode' };

// ---------------------------------------------------------------- Mode A : connexion PKCE

interface Tokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // ms
}

function loadTokens(): Tokens | null {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? 'null') as Tokens | null;
  } catch {
    return null;
  }
}
function saveTokens(t: Tokens | null) {
  try {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    /* stockage refusé : connexion valable pour la session */
  }
  spotifyConnected.value = !!t;
}

export const spotifyConnected = signal<boolean>(!!loadTokens());

/** Adresse de retour déclarée chez Spotify : la racine de l'app. */
export const redirectUri = () => location.origin + import.meta.env.BASE_URL;

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function startSpotifyLogin(): Promise<void> {
  const clientId = settings.value.spotifyClientId.trim();
  if (!clientId) throw new ProviderError('Saisis d’abord le Client ID de ton app Spotify.');
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, back: location.hash || '#/reglages' }));
  const u = new URL(`${ACCOUNTS}/authorize`);
  u.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    // Aucune permission demandée : la recherche ne lit rien de personnel.
  }).toString();
  location.assign(u.toString());
}

/** À appeler au démarrage : termine la connexion si on revient de Spotify (?code=…&state=…). */
export async function completeSpotifyLogin(): Promise<'none' | 'ok' | string> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const err = params.get('error');
  if (!code && !err) return 'none';
  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null') as { verifier: string; state: string; back: string } | null;
  sessionStorage.removeItem(PKCE_KEY);
  // Nettoie l'adresse (le code ne doit pas rester dans l'historique).
  history.replaceState(null, '', import.meta.env.BASE_URL + (saved?.back ?? '#/reglages'));
  if (err) return err === 'access_denied' ? 'Connexion à Spotify annulée.' : `Spotify a refusé la connexion (${err}).`;
  if (!saved || params.get('state') !== saved.state) return 'Connexion Spotify invalide, recommence depuis Réglages.';
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: redirectUri(),
      client_id: settings.value.spotifyClientId.trim(),
      code_verifier: saved.verifier,
    }),
  });
  if (!res.ok) return 'Spotify a refusé la connexion : vérifie le Client ID et l’adresse de redirection.';
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  saveTokens({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in - 60) * 1000 });
  return 'ok';
}

export function disconnectSpotify(): void {
  saveTokens(null);
}

async function accessToken(): Promise<string> {
  const t = loadTokens();
  if (!t) throw new ProviderError('Connecte Spotify dans Réglages, ou colle un lien Spotify.');
  if (Date.now() < t.expires_at) return t.access_token;
  if (!t.refresh_token) {
    saveTokens(null);
    throw new ProviderError('Connexion Spotify expirée : reconnecte-toi dans Réglages.');
  }
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: settings.value.spotifyClientId.trim() }),
  });
  if (!res.ok) {
    saveTokens(null);
    throw new ProviderError('Connexion Spotify expirée : reconnecte-toi dans Réglages.');
  }
  const n = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const next = { access_token: n.access_token, refresh_token: n.refresh_token ?? t.refresh_token, expires_at: Date.now() + (n.expires_in - 60) * 1000 };
  saveTokens(next);
  return next.access_token;
}

async function api<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const token = await accessToken();
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ProviderError('Pas de connexion à Spotify.');
  }
  if (res.status === 401) {
    saveTokens(null);
    throw new ProviderError('Connexion Spotify expirée : reconnecte-toi dans Réglages.');
  }
  if (res.status === 403) throw new ProviderError('Spotify refuse l’accès : ton compte doit être ajouté comme utilisateur de l’app Spotify (et l’abonnement Premium actif).');
  if (res.status === 429) throw new ProviderError('Trop de recherches Spotify, réessaie dans un instant.');
  if (!res.ok) throw new ProviderError(`Spotify a répondu ${res.status}.`);
  return (await res.json()) as T;
}

interface SpotifyObject {
  id: string;
  name: string;
  type: SpotifySubtype;
  images?: { url: string; width?: number }[];
  album?: { images?: { url: string }[]; release_date?: string };
  artists?: { name: string }[];
  release_date?: string;
  publisher?: string;
  show?: { name: string; publisher?: string; images?: { url: string }[] };
  external_urls?: { spotify?: string };
}

function toResult(type: SpotifySubtype, o: SpotifyObject): SearchResult {
  const images = o.images?.length ? o.images : (o.album?.images ?? o.show?.images ?? []);
  const big = images[0]?.url ?? null;
  const small = images[images.length - 1]?.url ?? big;
  const creator =
    type === 'show' ? (o.publisher ?? '') : type === 'episode' ? (o.show?.name ?? '') : type === 'artist' ? '' : (o.artists ?? []).map((a) => a.name).slice(0, 2).join(', ');
  const year = yearOf(o.release_date ?? o.album?.release_date);
  const link = o.external_urls?.spotify ?? `${OPEN}/${type}/${o.id}`;
  const category = isPodcastType(type) ? ('podcast' as const) : ('musique' as const);
  return {
    key: `sp:${type}:${o.id}`,
    category,
    title: o.name,
    creator,
    year,
    cover: small,
    kind: KIND_LABEL[type],
    sourceId: o.id,
    resolve: async () => ({ category, title: o.name, creator, year, cover: big, link, source: { provider: 'spotify', id: o.id, subtype: type } }),
  };
}

/** Mode A : recherche. Musique → albums, titres, artistes ; podcast → émissions, épisodes. (10 résultats max par type côté Spotify.) */
export async function searchSpotify(category: 'musique' | 'podcast', query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const types: SpotifySubtype[] = category === 'musique' ? ['album', 'track', 'artist'] : ['show', 'episode'];
  const body = await api<Record<string, { items: (SpotifyObject | null)[] } | undefined>>(
    '/search',
    { q: query, type: types.join(','), market: 'FR', limit: '6' },
    signal,
  );
  const out: SearchResult[] = [];
  for (const t of types) for (const o of body[`${t}s`]?.items ?? []) if (o) out.push(toResult(t, o));
  return out;
}

export { SUBTYPES };
