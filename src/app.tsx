import { useEffect } from 'preact/hooks';
import './styles/ui.css';
import './styles/library.css';
import { Nav } from './components/Nav';
import { Sheet, Toast, UpdateBanner } from './components/Overlays';
import { route } from './router';
import { isConfigured, settings } from './settings/settings';
import { enrichImported, needsEnrichment } from './import/enrich';
import { engine, installSyncTriggers, startSync } from './sync/store';
import { Setup } from './screens/Setup';
import { SettingsScreen } from './screens/Settings';
import { Library } from './screens/Library';
import { Add } from './screens/Add';
import { ItemForm } from './screens/ItemForm';
import { Tags } from './screens/Tags';
import { ImportImdb } from './screens/ImportImdb';
import { pendingDraft } from './state/draft';
import { refreshStaleAvailability } from './sync/availabilityRefresh';

function Screen() {
  const r = route.value;
  const data = engine.value?.data.value;
  switch (r.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'tags':
      return <Tags />;
    case 'import':
      return <ImportImdb />;
    case 'add':
      return <Add />;
    case 'addForm':
      return <ItemForm key={`add-${r.category}`} mode="add" category={r.category} initial={pendingDraft.peek() ?? undefined} />;
    case 'edit': {
      const item = data?.items.find((i) => i.id === r.id);
      return item ? <ItemForm key={`edit-${item.id}`} mode="edit" item={item} /> : <Library />;
    }
    default:
      return <Library />;
  }
}

export function App() {
  const configured = isConfigured.value;

  useEffect(() => {
    installSyncTriggers();
    if (configured && !engine.value)
      void startSync()
        .then(() => refreshStaleAvailability())
        .then(() => {
          // Fiches venues d'IMDb pas encore complétées (affiche, disponibilité) : on s'en occupe en arrière-plan.
          if (settings.value.tmdbKey && engine.value?.data.value?.items.some(needsEnrichment)) void enrichImported();
        });
  }, [configured]);

  // Sans réglages, le site public ne montre que l'écran de configuration.
  if (!configured) return <div class="app"><Setup /></div>;

  return (
    <div class="app">
      <div class="shell">
        <Nav />
        <main class="main">
          <Screen />
        </main>
      </div>
      <Sheet />
      <UpdateBanner />
      <Toast />
    </div>
  );
}
