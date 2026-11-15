import { SyncBadge } from '../components/SyncBadge';
import { engine } from '../sync/store';
import { hrefFor } from '../router';

// Étape 2 : on vérifie que les données arrivent bien. La liste complète (filtres, grille, fiche) arrive à l'étape 3.
export function Library() {
  const e = engine.value;
  const data = e?.data.value;
  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <span class="wordmark">
            Cult<em>ure</em>
          </span>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="settings">
          {!data && e?.status.value === 'error' ? (
            <section class="card">
              <h2>Impossible de charger tes données</h2>
              <p class="testres err">{e.error.value}</p>
              <p>
                <a class="linkbtn" href={hrefFor('settings')}>
                  Vérifier les réglages
                </a>
              </p>
            </section>
          ) : !data ? (
            <section class="card">
              <p class="small">Chargement de tes données…</p>
            </section>
          ) : (
            <section class="card">
              <h2>
                {data.items.length} fiche{data.items.length > 1 ? 's' : ''} · {data.tags.length} tag{data.tags.length > 1 ? 's' : ''}
              </h2>
              <div class="taglist">
                {data.tags.map((t) => (
                  <span class="tag" key={t.id} style={{ '--tc': t.color }}>
                    {t.name}
                  </span>
                ))}
              </div>
              <p class="small">La liste, les filtres et l'ajout de fiches arrivent à l'étape 3.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <h1 class="h-title">{title}</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="settings">
          <section class="card">
            <p class="small">Cet écran arrive à l'étape 3.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
