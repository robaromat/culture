import type { Category } from '../model/types';
import type { IconName } from './Icon';

export const CAT_ICON: Record<Category, IconName> = {
  livre: 'book',
  film: 'film',
  serie: 'tv',
  musique: 'music',
  podcast: 'mic',
  autre: 'spark',
};

export const CATEGORY_ORDER: Category[] = ['livre', 'film', 'serie', 'musique', 'podcast', 'autre'];
