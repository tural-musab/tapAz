import categoriesDataset from '@/data/categories.json';
import listingsDataset from '@/data/listings.json';
import { EXCLUDED_CATEGORY_IDS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants';
import {
  Category,
  Listing,
  ListingFilters,
  ListingQueryOptions,
  ListingQueryResult,
  AggregateStats,
  SortField
} from './types';

const categories: Category[] = (categoriesDataset as Category[]).filter(
  (category) => !EXCLUDED_CATEGORY_IDS.includes(category.id)
);

const listings: Listing[] = listingsDataset as Listing[];

export const getCategories = (): Category[] => categories;

export const getCategoryById = (id?: string): Category | undefined =>
  categories.find((category) => category.id === id);

export const getSubcategories = (categoryId?: string) => {
  const category = getCategoryById(categoryId);
  return category?.subcategories ?? [];
};

const applyFilters = (items: Listing[], filters: ListingFilters): Listing[] =>
  items.filter((item) => {
    if (filters.categoryId && item.categoryId !== filters.categoryId) return false;
    if (filters.subcategoryId && item.subcategoryId !== filters.subcategoryId) return false;
    if (typeof filters.isNew === 'boolean' && item.isNew !== filters.isNew) return false;
    if (filters.sellerType && filters.sellerType !== 'all' && item.sellerType !== filters.sellerType) {
      return false;
    }
    if (filters.minPrice && item.price < filters.minPrice) return false;
    if (filters.maxPrice && item.price > filters.maxPrice) return false;
    if (filters.minViews && item.viewCount < filters.minViews) return false;
    if (filters.maxViews && item.viewCount > filters.maxViews) return false;
    if (filters.city && item.city !== filters.city) return false;
    if (filters.query) {
      const normalizedQuery = filters.query.toLocaleLowerCase('az');
      const matchesTitle = item.title.toLocaleLowerCase('az').includes(normalizedQuery);
      const matchesDescription = item.description.toLocaleLowerCase('az').includes(normalizedQuery);
      if (!matchesTitle && !matchesDescription) return false;
    }
    return true;
  });

const sortListings = (items: Listing[], field: SortField, direction: 'asc' | 'desc'): Listing[] => {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    switch (field) {
      case 'price':
        return (a.price - b.price) * multiplier;
      case 'date':
        return (new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()) * multiplier;
      case 'favorites':
        return (a.favoriteCount - b.favoriteCount) * multiplier;
      case 'views':
      default:
        return (a.viewCount - b.viewCount) * multiplier;
    }
  });
};

const clampPageSize = (pageSize: number) => Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);

const paginate = (items: Listing[], page: number, pageSize: number): Listing[] => {
  const safePageSize = clampPageSize(pageSize);
  const offset = Math.max(page - 1, 0) * safePageSize;
  return items.slice(offset, offset + safePageSize);
};

const buildAggregateStats = (items: Listing[]): AggregateStats => {
  if (items.length === 0) {
    return {
      avgPrice: 0,
      avgViews: 0,
      totalListings: 0,
      topStores: []
    };
  }

  const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
  const totalViews = items.reduce((sum, item) => sum + item.viewCount, 0);

  const hottestListing = [...items].sort((a, b) => b.viewCount - a.viewCount)[0];
  const freshestListing = [...items].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  )[0];

  const sellerMap = items.reduce<Map<string, { totalViews: number; listingCount: number }>>((map, item) => {
    const record = map.get(item.sellerName) ?? { totalViews: 0, listingCount: 0 };
    record.totalViews += item.viewCount;
    record.listingCount += 1;
    map.set(item.sellerName, record);
    return map;
  }, new Map());

  const topStores = Array.from(sellerMap.entries())
    .map(([sellerName, stats]) => ({ sellerName, ...stats }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 3);

  return {
    avgPrice: Number((totalPrice / items.length).toFixed(1)),
    avgViews: Number((totalViews / items.length).toFixed(1)),
    totalListings: items.length,
    hottestListing,
    freshestListing,
    topStores
  };
};

export const queryListings = (options: Partial<ListingQueryOptions>): ListingQueryResult => {
  const {
    filters = {},
    sortField = 'views',
    sortDirection = 'desc',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE
  } = options;

  const filtered = applyFilters(listings, filters);
  const sorted = sortListings(filtered, sortField, sortDirection);
  const pagedItems = paginate(sorted, page, pageSize);
  const stats = buildAggregateStats(filtered);

  return {
    items: pagedItems,
    total: filtered.length,
    page,
    pageSize: clampPageSize(pageSize),
    stats
  };
};

