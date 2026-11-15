import type { Item, Tag } from '../model/types';
import { settings } from '../settings/settings';
import { Icon } from './Icon';

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span class="tag" style={{ '--tc': tag.color }}>
      {tag.name}
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span class="stars" role="img" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" class={n <= value ? 'on' : ''} />
      ))}
    </span>
  );
}

/** Badges des abonnements suivis (et activés dans Réglages) où le titre est inclus. */
export function ProviderBadges({ item }: { item: Item }) {
  const providers = item.availability?.providers ?? [];
  const tracked = settings.value.providers.filter((p) => p.enabled && providers.includes(p.key));
  return (
    <>
      {tracked.map((p) => (
        <span key={p.key} class={`prov p-${p.key}`}>
          {p.name}
        </span>
      ))}
    </>
  );
}

/** Clés des abonnements activés (pour le filtre « Sur mes abonnements »). */
export const enabledProviderKeys = () => settings.value.providers.filter((p) => p.enabled).map((p) => p.key);
