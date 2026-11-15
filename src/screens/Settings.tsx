import { useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { clearSettings, repoRef, settings, updateSettings } from '../settings/settings';
import { serialize, testConnection } from '../sync/github';
import { engine, mutate, resetLocal, startSync } from '../sync/store';
import { testTmdbKey } from '../providers/tmdb';
import { parseDataFile } from '../model/validate';
import type { DataFile } from '../model/types';
import { relativeTime } from '../lib/time';
import { hrefOf } from '../router';
import { installPrompt, isStandalone } from '../pwa';
import { disconnectSpotify, redirectUri as spotifyRedirectUri, spotifyConnected, startSpotifyLogin } from '../providers/spotify';

type Test = null | { state: 'wait' } | { state: 'ok'; text: string } | { state: 'err'; text: string };

function TestResult({ t }: { t: Test }) {
  if (!t) return null;
  if (t.state === 'wait') return <span class="testres wait">Test en cours…</span>;
  return (
    <span class={`testres ${t.state}`} role="status">
      {t.state === 'ok' && <Icon name="check" />}
      {t.text}
    </span>
  );
}

function SecretInput({ id, value, onInput, placeholder }: { id: string; value: string; onInput: (v: string) => void; placeholder?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div class="secret">
      <input class="input mono" id={id} type={shown ? 'text' : 'password'} autocomplete="off" spellcheck={false} placeholder={placeholder} value={value} onInput={(e) => onInput(e.currentTarget.value)} />
      <button type="button" class="iconbtn" aria-label={shown ? 'Masquer' : 'Afficher'} aria-pressed={shown} onClick={() => setShown(!shown)}>
        <Icon name="eye" />
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const s = settings.value;
  const e = engine.value;
  const data = e?.data.value;

  // --- GitHub
  const [token, setToken] = useState(s.githubToken);
  const [owner, setOwner] = useState(s.owner);
  const [repo, setRepo] = useState(s.repo);
  const [ghTest, setGhTest] = useState<Test>(null);

  async function saveGitHub() {
    setGhTest({ state: 'wait' });
    const draft = { githubToken: token.trim(), owner: owner.trim(), repo: repo.trim() };
    const t = await testConnection(repoRef({ ...settings.value, ...draft }));
    if (t.ok) {
      const changed = draft.githubToken !== s.githubToken || draft.owner !== s.owner || draft.repo !== s.repo;
      updateSettings(draft);
      setGhTest({ state: 'ok', text: `Connecté · ${draft.owner}/${draft.repo} · ${t.items} fiche${t.items > 1 ? 's' : ''}, ${t.tags} tag${t.tags > 1 ? 's' : ''}` });
      if (changed) void startSync();
    } else {
      setGhTest({ state: 'err', text: t.kind === 'no_file' ? 'Ce dépôt n’a pas de data.json.' : t.message });
    }
  }

  // --- TMDB
  const [tmdb, setTmdb] = useState(s.tmdbKey);
  const [tmdbTest, setTmdbTest] = useState<Test>(null);
  async function saveTmdb() {
    setTmdbTest({ state: 'wait' });
    const r = await testTmdbKey(tmdb);
    if (r.ok) {
      updateSettings({ tmdbKey: tmdb.trim() });
      setTmdbTest({ state: 'ok', text: 'Clé valide, enregistrée' });
    } else setTmdbTest({ state: 'err', text: r.message });
  }

  // --- Spotify
  const [spotify, setSpotify] = useState(s.spotifyClientId);
  const [spTest, setSpTest] = useState<Test>(null);
  const redirectUri = spotifyRedirectUri();

  // --- Sauvegarde
  const fileInput = useRef<HTMLInputElement>(null);
  const [importDraft, setImportDraft] = useState<DataFile | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  function exportData() {
    if (!data) return;
    const blob = new Blob([serialize(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `culture-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function pickImport(ev: Event) {
    const f = (ev.currentTarget as HTMLInputElement).files?.[0];
    (ev.currentTarget as HTMLInputElement).value = '';
    if (!f) return;
    setImportErr(null);
    try {
      const parsed = parseDataFile(JSON.parse(await f.text()));
      if (!parsed) setImportErr('Ce fichier n’est pas une sauvegarde Culture (schemaVersion 1 attendu).');
      else setImportDraft(parsed);
    } catch {
      setImportErr('Fichier illisible : ce n’est pas du JSON.');
    }
  }

  // --- Appareil
  const [confirmLogout, setConfirmLogout] = useState(false);
  async function logout() {
    await resetLocal();
    clearSettings();
  }

  const n = data?.items.length ?? 0;

  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <h1 class="h-title">Réglages</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="settings">
          <section class="card">
            <h2>
              <Icon name="cloud" />
              Données (GitHub)
            </h2>
            <p class="lead">Tes fiches sont dans un dépôt privé. Le jeton reste sur cet appareil.</p>
            <div class="field">
              <label for="s-tok">Jeton GitHub</label>
              <SecretInput id="s-tok" value={token} onInput={setToken} placeholder="github_pat_…" />
            </div>
            <div class="fgrid2">
              <div class="field">
                <label for="s-own">Propriétaire</label>
                <input class="input" id="s-own" autocapitalize="off" value={owner} onInput={(ev) => setOwner(ev.currentTarget.value)} />
              </div>
              <div class="field">
                <label for="s-repo">Dépôt</label>
                <input class="input" id="s-repo" autocapitalize="off" value={repo} onInput={(ev) => setRepo(ev.currentTarget.value)} />
              </div>
            </div>
            <div class="btnrow">
              <button class="btn small" onClick={saveGitHub}>
                Enregistrer et tester
              </button>
              <TestResult t={ghTest} />
            </div>
            {e && (
              <div class="syncinfo">
                {e.error.value && <p class="testres err">{e.error.value}</p>}
                <span class="small">
                  {e.lastSyncAt.value ? `Dernière synchro ${relativeTime(e.lastSyncAt.value)}` : 'Pas encore synchronisé'}
                  {e.hasPendingChanges ? ' · des modifications attendent d’être envoyées' : ''}
                </span>
                <button class="linkbtn" onClick={() => void e.sync()}>
                  <Icon name="refresh" />
                  Synchroniser maintenant
                </button>
              </div>
            )}
          </section>

          <section class="card">
            <h2>
              <Icon name="film" />
              Films et séries (TMDB)
            </h2>
            <div class="field">
              <label for="s-tmdb">Clé API TMDB</label>
              <SecretInput id="s-tmdb" value={tmdb} onInput={setTmdb} placeholder="Clé API ou jeton de lecture" />
            </div>
            <div class="btnrow">
              <button class="btn small" onClick={saveTmdb}>
                Enregistrer et tester
              </button>
              <TestResult t={tmdbTest} />
            </div>
          </section>

          <section class="card">
            <h2>
              <Icon name="music" />
              Spotify
            </h2>
            <p class="lead">Facultatif. Sans lui, tu pourras toujours coller un lien Spotify.</p>
            <div class="field">
              <label for="s-sp">Client ID</label>
              <input
                class="input mono"
                id="s-sp"
                autocomplete="off"
                spellcheck={false}
                placeholder="Client ID de ton app Spotify"
                value={spotify}
                onInput={(ev) => setSpotify(ev.currentTarget.value)}
                onBlur={() => updateSettings({ spotifyClientId: spotify.trim() })}
              />
            </div>
            <p class="small">
              Adresse de redirection à déclarer chez Spotify : <span class="mono">{redirectUri}</span>
            </p>
            {spotifyConnected.value ? (
              <div class="btnrow">
                <span class="testres ok"><Icon name="check" />Connecté : recherche Spotify active</span>
                <button class="btn small ghost" onClick={disconnectSpotify}>Déconnecter</button>
              </div>
            ) : (
              <div class="btnrow">
                <button
                  class="btn small"
                  disabled={!spotify.trim()}
                  onClick={async () => {
                    updateSettings({ spotifyClientId: spotify.trim() });
                    try {
                      await startSpotifyLogin();
                    } catch (err) {
                      setSpTest({ state: 'err', text: err instanceof Error ? err.message : String(err) });
                    }
                  }}
                >
                  Se connecter à Spotify
                </button>
                <TestResult t={spTest} />
              </div>
            )}
          </section>

          <section class="card">
            <h2>
              <Icon name="tv" />
              Mes abonnements
            </h2>
            <p class="lead">
              Pour les badges et le filtre « Sur mes abonnements ». Pays : France. Seul ce qui est inclus dans l'abonnement compte (pas
              la location, l'achat ni les chaînes vendues en supplément).
            </p>
            {s.providers.map((p) => (
              <div class="toggle" key={p.key}>
                <span>{p.name}</span>
                <button
                  class="sw-t"
                  role="switch"
                  aria-checked={p.enabled}
                  aria-label={p.name}
                  onClick={() => updateSettings({ providers: s.providers.map((x) => (x.key === p.key ? { ...x, enabled: !x.enabled } : x)) })}
                />
              </div>
            ))}
            <p class="small">Données de disponibilité : JustWatch</p>
          </section>

          <section class="card">
            <h2>
              <Icon name="download" />
              Sauvegarde
            </h2>
            <p class="lead">Chaque modification est déjà un commit sur GitHub. Ici, une copie manuelle du fichier.</p>
            <div class="btnrow">
              <button class="btn small" onClick={exportData} disabled={!data}>
                <Icon name="download" />
                Exporter data.json
              </button>
              <button class="btn small" onClick={() => fileInput.current?.click()} disabled={!data}>
                <Icon name="upload" />
                Importer
              </button>
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={pickImport} />
            </div>
            <a class="btn small" href={hrefOf({ name: 'import' })}>
              <Icon name="film" />
              Importer une liste IMDb (Watchlist…)
            </a>
            {importErr && <p class="testres err">{importErr}</p>}
            {importDraft && (
              <div class="confirm">
                <b>Remplacer toutes tes données par ce fichier ?</b>
                <span class="small">
                  Tes {n} fiche{n > 1 ? 's' : ''} actuelle{n > 1 ? 's' : ''} seront remplacées par {importDraft.items.length} fiche
                  {importDraft.items.length > 1 ? 's' : ''} et {importDraft.tags.length} tag{importDraft.tags.length > 1 ? 's' : ''}. L'ancienne
                  version reste dans l'historique GitHub.
                </span>
                <div class="btnrow">
                  <button
                    class="btn small primary"
                    onClick={() => {
                      mutate(() => importDraft);
                      setImportDraft(null);
                    }}
                  >
                    Remplacer
                  </button>
                  <button class="btn small ghost" onClick={() => setImportDraft(null)}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </section>

          <section class="card">
            <h2>
              <Icon name="download" />
              Application
            </h2>
            {isStandalone() ? (
              <p class="testres ok"><Icon name="check" />Culture est installée sur cet appareil et fonctionne hors connexion.</p>
            ) : installPrompt.value ? (
              <div>
                <button
                  class="btn small primary"
                  onClick={async () => {
                    const p = installPrompt.value;
                    if (!p) return;
                    await p.prompt();
                    await p.userChoice;
                    installPrompt.value = null;
                  }}
                >
                  <Icon name="download" />Installer Culture sur cet appareil
                </button>
              </div>
            ) : (
              <p class="small">
                Pour l'avoir comme une app (icône, plein écran, hors connexion) : sur Android, menu ⋮ de Chrome → « Installer l'application » ou
                « Ajouter à l'écran d'accueil » ; sur iPhone, Safari → Partager → « Sur l'écran d'accueil ».
              </p>
            )}
          </section>

          <section class="card">
            <h2>
              <Icon name="logout" />
              Cet appareil
            </h2>
            {confirmLogout ? (
              <div class="confirm">
                <b>Déconnecter cet appareil ?</b>
                <span class="small">
                  Le jeton, les clés et le cache local sont effacés de cet appareil. Tes données restent sur GitHub.
                  {e?.hasPendingChanges ? ' Attention : des modifications pas encore envoyées seront perdues.' : ''}
                </span>
                <div class="btnrow">
                  <button class="btn small danger" onClick={logout}>
                    Déconnecter
                  </button>
                  <button class="btn small ghost" onClick={() => setConfirmLogout(false)}>
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button class="btn small danger ghost" onClick={() => setConfirmLogout(true)}>
                  Déconnecter cet appareil
                </button>
              </div>
            )}
          </section>

          <p class="small center">Culture v{__APP_VERSION__} · thème automatique (clair / sombre selon l'appareil)</p>
        </div>
      </div>
    </div>
  );
}
