import type { DataFile } from '../model/types';
import { base64ToUtf8, utf8ToBase64 } from '../lib/base64';
import { parseDataFile } from '../model/validate';

// Lecture / écriture de data.json dans le dépôt privé via l'API GitHub Contents.
// Chaque écriture envoie le sha de la version qu'on a lue : si quelqu'un (l'autre appareil) a écrit
// entre-temps, GitHub refuse (409/422) et c'est au moteur de synchro de fusionner puis réessayer.

export interface RepoRef {
  token: string;
  owner: string;
  repo: string;
  path?: string; // data.json par défaut
}

export interface RemoteFile {
  data: DataFile;
  sha: string;
}

export type GitHubErrorKind = 'auth' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limit' | 'network' | 'invalid' | 'server';

export class GitHubError extends Error {
  constructor(
    public kind: GitHubErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

const API = 'https://api.github.com';

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

const contentsUrl = (r: RepoRef) =>
  `${API}/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/contents/${r.path ?? 'data.json'}`;

async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new GitHubError('network', 'Pas de connexion à GitHub.');
  }
  if (res.ok) return res;
  const status = res.status;
  if (status === 401) throw new GitHubError('auth', 'Jeton GitHub refusé : il a peut-être expiré ou été mal copié.', status);
  if (status === 403 || status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || status === 429)
      throw new GitHubError('rate_limit', 'Trop de requêtes vers GitHub, nouvel essai dans quelques minutes.', status);
    throw new GitHubError('forbidden', "Le jeton n'a pas le droit d'écrire dans ce dépôt (permission Contents : Read and write).", status);
  }
  if (status === 404) throw new GitHubError('not_found', 'Dépôt ou fichier introuvable.', status);
  if (status === 409 || status === 422) throw new GitHubError('conflict', 'Le fichier a changé sur GitHub entre-temps.', status);
  throw new GitHubError('server', `GitHub a répondu ${status}.`, status);
}

interface ContentsResponse {
  sha: string;
  content?: string;
  encoding?: string;
}

export async function readDataFile(r: RepoRef): Promise<RemoteFile> {
  const res = await request(contentsUrl(r), { headers: headers(r.token) });
  const body = (await res.json()) as ContentsResponse;
  let text: string;
  if (body.encoding === 'base64' && body.content !== undefined) {
    text = base64ToUtf8(body.content);
  } else {
    // Au-delà de 1 Mo, l'API Contents ne renvoie pas le contenu : on passe par le blob.
    const blobRes = await request(
      `${API}/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/git/blobs/${body.sha}`,
      { headers: headers(r.token) },
    );
    const blob = (await blobRes.json()) as { content: string };
    text = base64ToUtf8(blob.content);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GitHubError('invalid', "data.json n'est pas un JSON valide.");
  }
  const data = parseDataFile(parsed);
  if (!data) throw new GitHubError('invalid', "data.json n'a pas le format attendu (schemaVersion 1).");
  return { data, sha: body.sha };
}

/** Écrit data.json. `sha` = version lue précédemment (absent pour créer le fichier). Renvoie le nouveau sha. */
export async function writeDataFile(r: RepoRef, data: DataFile, sha: string | null, message: string): Promise<string> {
  const res = await request(contentsUrl(r), {
    method: 'PUT',
    headers: { ...headers(r.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: utf8ToBase64(serialize(data)),
      ...(sha ? { sha } : {}),
    }),
  });
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

/** JSON lisible (diffs propres dans l'historique GitHub). */
export function serialize(data: DataFile): string {
  return JSON.stringify(data, null, 2) + '\n';
}

export type ConnectionTest =
  | { ok: true; items: number; tags: number }
  | { ok: false; kind: 'no_file' }
  | { ok: false; kind: GitHubErrorKind; message: string };

/** Pour le bouton « Tester la connexion » : distingue « dépôt inaccessible » et « dépôt OK mais pas de data.json ». */
export async function testConnection(r: RepoRef): Promise<ConnectionTest> {
  try {
    const f = await readDataFile(r);
    return { ok: true, items: f.data.items.length, tags: f.data.tags.length };
  } catch (e) {
    if (!(e instanceof GitHubError)) return { ok: false, kind: 'server', message: String(e) };
    if (e.kind === 'not_found') {
      try {
        await request(`${API}/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}`, { headers: headers(r.token) });
        return { ok: false, kind: 'no_file' };
      } catch {
        return {
          ok: false,
          kind: 'not_found',
          message: `Dépôt ${r.owner}/${r.repo} introuvable, ou le jeton n'y a pas accès.`,
        };
      }
    }
    return { ok: false, kind: e.kind, message: e.message };
  }
}
