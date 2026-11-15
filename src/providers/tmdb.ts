// Accès TMDB. On accepte la « clé API » v3 (32 caractères) comme le « jeton d'accès en lecture » v4 (long, commence par eyJ).

const API = 'https://api.themoviedb.org/3';

export function tmdbRequest(path: string, key: string, params: Record<string, string> = {}): Promise<Response> {
  const k = key.trim();
  const isBearer = k.startsWith('eyJ');
  const url = new URL(API + path);
  for (const [p, v] of Object.entries(params)) url.searchParams.set(p, v);
  if (!isBearer) url.searchParams.set('api_key', k);
  return fetch(url, { headers: isBearer ? { Authorization: `Bearer ${k}` } : {} });
}

export async function testTmdbKey(key: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!key.trim()) return { ok: false, message: 'Aucune clé saisie.' };
  try {
    const res = await tmdbRequest('/configuration', key);
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, message: 'Clé refusée par TMDB : vérifie qu’elle est complète.' };
    return { ok: false, message: `TMDB a répondu ${res.status}.` };
  } catch {
    return { ok: false, message: 'Pas de connexion à TMDB.' };
  }
}
