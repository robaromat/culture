import './app.css';

// Étape 1 du plan : une page en ligne, sans données. Les écrans validés en maquette arrivent aux étapes suivantes.
export function App() {
  return (
    <main class="welcome">
      <div class="welcome-in">
        <h1 class="wordmark">
          Cult<em>ure</em>
        </h1>
        <p class="intro">
          Tes livres, films, séries, musiques et podcasts à découvrir, synchronisés entre ton téléphone et ton
          ordinateur.
        </p>
        <p class="status">
          <span class="dot" aria-hidden="true" />
          En construction · l'app arrive bientôt ici
        </p>
        <p class="version">v{__APP_VERSION__}</p>
      </div>
    </main>
  );
}
