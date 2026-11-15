import { useEffect } from 'preact/hooks';
import './styles/ui.css';
import './styles/library.css';
import { Nav } from './components/Nav';
import { Sheet, Toast } from './components/Overlays';
import { route } from './router';
import { isConfigured } from './settings/settings';
import { engine, installSyncTriggers, startSync } from './sync/store';
import { Setup } from './screens/Setup';
import { SettingsScreen } from './screens/Settings';
import { Library } from './screens/Library';
import { Add } from './screens/Add';
import { ItemForm } from './screens/ItemForm';
import { Tags } from './screens/Tags';

function Screen() {
  const r = route.value;
  const data = engine.value?.data.value;
  switch (r.name) {
    case 'settings':
      return <SettingsScreen />;
    case 'tags':
      return <Tags />;
    case 'add':
      return <Add />;
    case 'addForm':
      return <ItemForm key={`add-${r.category}`} mode="add" category={r.category} />;
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
    if (configured && !engine.value) void startSync();
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
      <Toast />
    </div>
  );
}
