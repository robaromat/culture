import { route, hrefFor } from '../router';
import { Icon, type IconName } from './Icon';
import { CAT_ICON, CATEGORY_ORDER } from './catIcon';
import { CATEGORIES } from '../model/labels';
import { engine } from '../sync/store';
import { fCategory, fTags, toggleTagFilter } from '../state/ui';

type NavName = 'library' | 'add' | 'tags' | 'settings';
const ITEMS: { r: NavName; icon: IconName; label: string; add?: boolean }[] = [
  { r: 'library', icon: 'shelf', label: 'Bibliothèque' },
  { r: 'add', icon: 'plus', label: 'Ajouter', add: true },
  { r: 'tags', icon: 'tag', label: 'Tags' },
  { r: 'settings', icon: 'sliders', label: 'Réglages' },
];

function currentNav(): NavName {
  const n = route.value.name;
  if (n === 'item' || n === 'edit') return 'library';
  if (n === 'addForm' || n === 'article') return 'add';
  if (n === 'import') return 'settings';
  return n;
}

/** Barre du bas (Fold fermé), rail (Fold déplié), barre latérale avec filtres (ordinateur) : même composant, CSS différent. */
export function Nav() {
  const cur = currentNav();
  return (
    <nav class="nav" aria-label="Navigation">
      <div class="brand">
        <span class="wordmark">Cult<em>ure</em></span>
      </div>
      <div class="items">
        {ITEMS.map((it) => (
          <a key={it.r} class={`navbtn ${it.add ? 'add' : ''}`} href={hrefFor(it.r)} aria-current={cur === it.r ? 'page' : undefined}>
            <Icon name={it.icon} />
            <span>{it.label}</span>
          </a>
        ))}
      </div>
      {cur === 'library' && <NavFilters />}
    </nav>
  );
}

function NavFilters() {
  const data = engine.value?.data.value;
  if (!data) return null;
  const count = (c: string) => data.items.filter((i) => c === 'all' || i.category === c).length;
  return (
    <div class="navfilters">
      <div class="nf">
        <h4>Catégories</h4>
        <button class="opt2" aria-pressed={fCategory.value === 'all'} onClick={() => (fCategory.value = 'all')}>
          <Icon name="shelf" />Tout<span class="n">{count('all')}</span>
        </button>
        {CATEGORY_ORDER.map((c) => (
          <button key={c} class="opt2" aria-pressed={fCategory.value === c} onClick={() => (fCategory.value = c)}>
            <Icon name={CAT_ICON[c]} />
            {CATEGORIES[c].plural}
            <span class="n">{count(c)}</span>
          </button>
        ))}
      </div>
      {data.tags.length > 0 && (
        <div class="nf">
          <h4>Tags (cumulables)</h4>
          {[...data.tags].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((t) => {
            const on = fTags.value.includes(t.id);
            return (
              <button key={t.id} class="opt2" aria-pressed={on} onClick={() => toggleTagFilter(t.id)}>
                <span class="box">{on && <Icon name="check" />}</span>
                <span class="tdot" style={{ '--tc': t.color }} />
                {t.name}
                <span class="n">{data.items.filter((i) => i.tags.includes(t.id)).length}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
