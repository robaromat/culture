import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app';
import { completeSpotifyLogin } from './providers/spotify';
import { showToast } from './state/ui';

// Retour de la page de connexion Spotify (?code=…) : on termine la connexion avant d'afficher l'app.
async function boot() {
  try {
    const r = await completeSpotifyLogin();
    if (r === 'ok') setTimeout(() => showToast('Spotify connecté'), 300);
    else if (r !== 'none') setTimeout(() => showToast(r), 300);
  } catch {
    setTimeout(() => showToast('Connexion Spotify impossible (réseau ?)'), 300);
  }
  const root = document.getElementById('app');
  if (root) render(<App />, root);
}

void boot();
