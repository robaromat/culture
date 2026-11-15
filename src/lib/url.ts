/** N'accepte que des liens http(s) : un « javascript:… » collé dans une fiche ne doit jamais devenir cliquable. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Libellé du bouton « Ouvrir » selon le site du lien. */
export function openLabel(url: string): string {
  const host = new URL(url).hostname;
  if (host.endsWith('spotify.com')) return 'Ouvrir dans Spotify';
  if (host.endsWith('themoviedb.org')) return 'Ouvrir dans TMDB';
  if (host.endsWith('imdb.com')) return 'Ouvrir dans IMDb';
  return 'Ouvrir le lien';
}
