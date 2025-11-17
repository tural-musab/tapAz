import { NextResponse } from 'next/server';
import { queryListings } from '@/lib/data';
import { ListingFilters, SortField } from '@/lib/types';
import { SORT_FIELDS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const parseNumber = (value?: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBoolean = (value?: string | null) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const filters: ListingFilters = {
    categoryId: searchParams.get('categoryId') ?? undefined,
    subcategoryId: searchParams.get('subcategoryId') ?? undefined,
    query: searchParams.get('query') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    isNew: parseBoolean(searchParams.get('isNew')),
    sellerType: (searchParams.get('sellerType') as ListingFilters['sellerType']) ?? 'all',
    minPrice: parseNumber(searchParams.get('minPrice')),
    maxPrice: parseNumber(searchParams.get('maxPrice')),
    minViews: parseNumber(searchParams.get('minViews')),
    maxViews: parseNumber(searchParams.get('maxViews'))
  };

  const sortParam = (searchParams.get('sort') ?? 'views') as SortField;
  const sortField = Object.keys(SORT_FIELDS).includes(sortParam) ? sortParam : 'views';
  const sortDirection = searchParams.get('direction') === 'asc' ? 'asc' : 'desc';

  const page = parseNumber(searchParams.get('page')) ?? 1;
  const pageSize = parseNumber(searchParams.get('pageSize')) ?? undefined;

  const result = queryListings({
    filters,
    sortField,
    sortDirection,
    page,
    pageSize
  });

  return NextResponse.json({
    items: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    stats: result.stats
  });
}

