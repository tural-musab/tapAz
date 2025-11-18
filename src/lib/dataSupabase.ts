import type { PostgrestFilterBuilder, PostgrestClientOptions } from '@supabase/postgrest-js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/admin/supabaseClient';
import {
  Listing,
  ListingFilters,
  ListingQueryOptions,
  ListingQueryResult,
  SellerType,
  SortField
} from '@/lib/types';
import {
  getCategoryIdBySlug,
  getCategorySlugById,
  getSubcategoryIdBySlug,
  getSubcategorySlugById
} from '@/lib/data';

type ListingsRow = {
  id: string;
  tap_id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  location: string | null;
  listing_url: string | null;
  image_url: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  seller_name: string | null;
  seller_type: SellerType | null;
  posted_at_text: string | null;
  posted_at_iso: string | null;
  condition_label: string | null;
  view_count: number | null;
  favorites_count: number | null;
  is_new: boolean | null;
  fetched_at: string | null;
};

type EmptySchema = {
  Tables: Record<string, never>;
  Views: Record<string, never>;
  Functions: Record<string, never>;
};

type ListingsQueryBuilder = PostgrestFilterBuilder<
  PostgrestClientOptions,
  EmptySchema,
  ListingsRow,
  ListingsRow[],
  string,
  unknown,
  unknown
>;

const sortColumnMap: Record<SortField, string> = {
  views: 'view_count',
  price: 'price',
  date: 'posted_at_iso',
  favorites: 'favorites_count'
};

const clampPageSize = (value?: number) => Math.min(Math.max(value ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

const applyFilters = (query: ListingsQueryBuilder, filters: ListingFilters) => {
  const categorySlug = filters.categoryId ? getCategorySlugById(filters.categoryId) : undefined;
  const subcategorySlug = filters.subcategoryId
    ? getSubcategorySlugById(filters.categoryId, filters.subcategoryId)
    : undefined;

  if (categorySlug) {
    query = query.eq('category_slug', categorySlug);
  }
  if (subcategorySlug) {
    query = query.eq('subcategory_slug', subcategorySlug);
  }
  if (typeof filters.isNew === 'boolean') {
    query = query.eq('is_new', filters.isNew);
  }
  if (filters.sellerType && filters.sellerType !== 'all') {
    query = query.eq('seller_type', filters.sellerType);
  }
  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice);
  }
  if (filters.minViews !== undefined) {
    query = query.gte('view_count', filters.minViews);
  }
  if (filters.maxViews !== undefined) {
    query = query.lte('view_count', filters.maxViews);
  }
  if (filters.city) {
    query = query.ilike('location', `%${filters.city}%`);
  }
  if (filters.query) {
    const normalized = filters.query.trim();
    if (normalized) {
      const likeValue = `%${normalized}%`;
      query = query.or(
        [
          `title.ilike.${likeValue}`,
          `description.ilike.${likeValue}`,
          `seller_name.ilike.${likeValue}`
        ].join(',')
      );
    }
  }

  return query;
};

const mapRowToListing = (row: ListingsRow): Listing => ({
  id: row.id ?? row.tap_id ?? 'tapaz-missing-id',
  tapId: row.tap_id ?? row.id ?? 'tapaz-missing-id',
  title: row.title ?? 'Tap.az elan',
  description: row.description ?? '',
  categoryId: getCategoryIdBySlug(row.category_slug ?? undefined) ?? (row.category_slug ?? 'generic'),
  subcategoryId:
    getSubcategoryIdBySlug(row.category_slug ?? undefined, row.subcategory_slug ?? undefined) ??
    (row.subcategory_slug ?? 'generic'),
  isNew: Boolean(row.is_new ?? false),
  price: Number(row.price ?? 0),
  currency: row.currency ?? 'AZN',
  sellerType: (row.seller_type ?? 'individual') as SellerType,
  sellerName: row.seller_name ?? 'Naməlum satıcı',
  city: row.location ?? 'Bakı',
  postedAt: row.posted_at_iso ?? row.fetched_at ?? new Date().toISOString(),
  viewCount: row.view_count ?? 0,
  favoriteCount: row.favorites_count ?? 0,
  listingUrl: row.listing_url ?? '/',
  imageUrl: row.image_url ?? undefined
});

const fetchAggregateStats = async (
  filters: ListingFilters,
  total: number
): Promise<ListingQueryResult['stats']> => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      avgPrice: 0,
      avgViews: 0,
      totalListings: total,
      topStores: []
    };
  }

  const statsQuery = (columns = '*') =>
    applyFilters(supabase.from('scraped_listings').select(columns), filters);

  const [avgResult, hottestResult, freshestResult] = await Promise.all([
    statsQuery('avg_price:avg(price), avg_views:avg(view_count)').maybeSingle(),
    statsQuery()
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(1),
    statsQuery()
      .order('posted_at_iso', { ascending: false, nullsFirst: false })
      .limit(1)
  ]);

  const hottestListing = hottestResult.data?.[0] ? mapRowToListing(hottestResult.data[0] as ListingsRow) : undefined;
  const freshestListing = freshestResult.data?.[0] ? mapRowToListing(freshestResult.data[0] as ListingsRow) : undefined;
  const avgStats = (avgResult.data as { avg_price?: number | null; avg_views?: number | null } | null) ?? null;

  return {
    avgPrice: Number(avgStats?.avg_price ?? 0),
    avgViews: Number(avgStats?.avg_views ?? 0),
    totalListings: total,
    hottestListing,
    freshestListing,
    topStores: []
  };
};

export const canUseSupabaseListings = () => hasSupabaseAdmin();

export const queryListingsFromSupabase = async (
  options: Partial<ListingQueryOptions>
): Promise<ListingQueryResult> => {
  if (!hasSupabaseAdmin()) {
    throw new Error('Supabase deaktivdir');
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error('Supabase client mövcud deyil');
  }

  const filters = options.filters ?? {};
  const page = Math.max(1, options.page ?? 1);
  const pageSize = clampPageSize(options.pageSize);
  const offset = (page - 1) * pageSize;
  const sortField = options.sortField ?? 'views';
  const sortDirection = options.sortDirection ?? 'desc';
  const sortColumn = sortColumnMap[sortField] ?? 'view_count';

  const buildFilteredQuery = (
    columns = '*',
    options?: {
      count?: 'exact' | 'planned' | 'estimated';
    }
  ) =>
    applyFilters(
      supabase
        .from('scraped_listings')
        .select(columns, options?.count ? { count: options.count } : undefined),
      filters
    );

  const baseQuery = buildFilteredQuery(
    `
    id,
    tap_id,
    title,
    description,
    price,
    currency,
    location,
    listing_url,
    image_url,
    category_slug,
    subcategory_slug,
    seller_name,
    seller_type,
    posted_at_text,
    posted_at_iso,
    condition_label,
    view_count,
    favorites_count,
    is_new,
    fetched_at
  `,
    { count: 'exact' }
  );

  const isAscending = sortDirection === 'asc';
  const nullsFirst = isAscending ? false : true;

  const { data, count, error } = await baseQuery
    .order(sortColumn, { ascending: isAscending, nullsFirst })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row: ListingsRow) => mapRowToListing(row));
  const stats = await fetchAggregateStats(filters, count ?? items.length);

  return {
    items,
    total: count ?? items.length,
    page,
    pageSize,
    stats
  };
};
