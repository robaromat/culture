import { useEffect } from 'preact/hooks';
import './styles/ui.css';
import { Nav } from './components/Nav';
import { route } from './router';
import { isConfigured } from './settings/settings';
import { engine, installSyncTriggers, startSync } from './sync/store';
import { Setup } from './screens/Setup';
import { SettingsScreen } from './screens/Settings';
import { ComingSoon, Library } from './screens/Library';

export function App() {
  const configured = isConfigured.value;

  useEffect(() => {
    installSyncTriggers();
    if (configured && !engine.value) void startSync();
  }, [configured]);

  // Sans réglages, le site public ne montre que l'écran de configuration.
  if (!configured) return <div class="app"><Setup /></div>;

  const r = route.value;
  return (
    <div class="app">
      <div class="shell">
        <Nav />
        <main class="main">
          {r === 'settings' ? <SettingsScreen /> : r === 'tags' ? <ComingSoon title="Tags" /> : r === 'add' ? <ComingSoon title="Ajouter" /> : <Library />}
        </main>
      </div>
    </div>
  );
}
