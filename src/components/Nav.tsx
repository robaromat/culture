import { route, hrefFor, type Route } from '../router';
import { Icon, type IconName } from './Icon';

const ITEMS: { r: Route; icon: IconName; label: string; add?: boolean }[] = [
  { r: 'library', icon: 'shelf', label: 'Bibliothèque' },
  { r: 'add', icon: 'plus', label: 'Ajouter', add: true },
  { r: 'tags', icon: 'tag', label: 'Tags' },
  { r: 'settings', icon: 'sliders', label: 'Réglages' },
];

/** Barre du bas (Fold fermé), rail (Fold déplié), barre latérale (ordinateur) : même composant, CSS différent. */
export function Nav() {
  return (
    <nav class="nav" aria-label="Navigation">
      <div class="brand">
        <span class="wordmark">
          Cult<em>ure</em>
        </span>
      </div>
      <div class="items">
        {ITEMS.map((it) => (
          <a
            key={it.r}
            class={`navbtn ${it.add ? 'add' : ''}`}
            href={hrefFor(it.r)}
            aria-current={route.value === it.r ? 'page' : undefined}
          >
            <Icon name={it.icon} />
            <span>{it.label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
