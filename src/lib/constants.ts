export const EXCLUDED_CATEGORY_IDS = ['jobs'];

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const SORT_FIELDS = {
  views: 'Baxış sayı',
  price: 'Qiymət',
  date: 'Elan tarixi',
  favorites: 'Favorit sayı'
} as const;

export type SortFieldKey = keyof typeof SORT_FIELDS;

