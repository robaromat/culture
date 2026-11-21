import { computed, signal } from '@preact/signals';

// Réglages propres à CET appareil, gardés dans localStorage : jeton GitHub, clés d'API, abonnements suivis.
// Rien de tout ça ne part dans un dépôt.

export interface TrackedProvider {
  key: string;
  name: string;
  /** Identifiants des fournisseurs côté TMDB / JustWatch (France). Une offre « avec pub » a son propre id. */
  tmdbIds: number[];
  enabled: boolean;
  /** Autres noms possibles chez JustWatch / TMDB. */
  aliases?: string[];
}

export interface Settings {
  githubToken: string;
  owner: string;
  repo: string;
  tmdbKey: string;
  spotifyClientId: string;
  providers: TrackedProvider[];
}

export const DEFAULT_PROVIDERS: TrackedProvider[] = [
  { key: 'netflix', name: 'Netflix', tmdbIds: [8, 1796], enabled: true },
  { key: 'prime', name: 'Prime Video', tmdbIds: [119, 2100], enabled: true },
  { key: 'canal', name: 'Canal+', tmdbIds: [381], enabled: true },
  // Plateformes gratuites (offre « free » chez JustWatch) : Arte (arte.tv) et France TV (france.tv).
  { key: 'arte', name: 'Arte', tmdbIds: [234], enabled: true, aliases: ['arte.tv'] },
  { key: 'francetv', name: 'France TV', tmdbIds: [236], enabled: true, aliases: ['france.tv', 'francetv', 'france tv'] },
];

const DEFAULTS: Settings = {
  githubToken: '',
  owner: 'robaromat',
  repo: 'culture-data',
  tmdbKey: '',
  spotifyClientId: '',
  providers: DEFAULT_PROVIDERS,
};

const KEY = 'culture.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const s = JSON.parse(raw) as Partial<Settings>;
    // Fournisseurs ajoutés dans une nouvelle version : complétés, sans toucher aux choix déjà faits.
    const saved = s.providers?.length ? s.providers : [];
    const providers = [
      ...saved.map((p) => ({ ...(DEFAULT_PROVIDERS.find((d) => d.key === p.key) ?? {}), ...p })),
      ...DEFAULT_PROVIDERS.filter((d) => !saved.some((p) => p.key === d.key)),
    ];
    return { ...DEFAULTS, ...s, providers };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = signal<Settings>(load());

export const isConfigured = computed(() => {
  const s = settings.value;
  return Boolean(s.githubToken && s.owner && s.repo);
});

export function updateSettings(patch: Partial<Settings>): void {
  settings.value = { ...settings.value, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.value));
  } catch {
    // Stockage refusé (navigation privée…) : les réglages valent pour la session seulement.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
  settings.value = { ...DEFAULTS };
}

export function repoRef(s: Settings = settings.value) {
  return { token: s.githubToken.trim(), owner: s.owner.trim(), repo: s.repo.trim() };
}
