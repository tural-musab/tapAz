"use client";

import { useEffect, useMemo, useState } from 'react';
import { Category, ListingFilters, ListingQueryResult, SortField } from '@/lib/types';
import FiltersPanel from './FiltersPanel';
import StatsCards from './StatsCards';
import ListingsTable from './ListingsTable';
import SortBar from './SortBar';
import PaginationControls from './PaginationControls';
import InfoBanner from './InfoBanner';

interface DashboardProps {
  categories: Category[];
  initialData: ListingQueryResult;
}

const DEFAULT_FILTERS: ListingFilters = {
  sellerType: 'all'
};

const buildQueryParams = (
  filters: ListingFilters,
  sortField: SortField,
  sortDirection: 'asc' | 'desc',
  page: number
) => {
  const params = new URLSearchParams();

  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.subcategoryId) params.set('subcategoryId', filters.subcategoryId);
  if (filters.query) params.set('query', filters.query);
  if (typeof filters.isNew === 'boolean') params.set('isNew', String(filters.isNew));
  if (filters.sellerType && filters.sellerType !== 'all') params.set('sellerType', filters.sellerType);
  if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
  if (filters.minViews) params.set('minViews', String(filters.minViews));
  if (filters.maxViews) params.set('maxViews', String(filters.maxViews));
  if (filters.city) params.set('city', filters.city);

  params.set('sort', sortField);
  params.set('direction', sortDirection);
  params.set('page', String(page));

  return params;
};

const isFiltering = (filters: ListingFilters) => {
  const clone = { ...filters };
  return Object.entries(clone).some(([key, value]) => {
    if (key === 'sellerType') {
      return value && value !== 'all';
    }
    return Boolean(value) || typeof value === 'boolean';
  });
};

export default function Dashboard({ categories, initialData }: DashboardProps) {
  const [filters, setFilters] = useState<ListingFilters>(DEFAULT_FILTERS);
  const [sortField, setSortField] = useState<SortField>('views');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(initialData.page);
  const [items, setItems] = useState(initialData.items ?? []);
  const [stats, setStats] = useState(initialData.stats);
  const [total, setTotal] = useState(initialData.total);
  const [pageSize] = useState(initialData.pageSize);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasActiveFilters = useMemo(() => isFiltering(filters), [filters]);

  const { categoryLabels, subcategoryLabels } = useMemo(() => {
    const categoryEntries: Record<string, string> = {};
    const subcategoryEntries: Record<string, string> = {};

    categories.forEach((category) => {
      categoryEntries[category.id] = category.name;
      category.subcategories.forEach((subcategory) => {
        subcategoryEntries[subcategory.id] = subcategory.name;
      });
    });

    return { categoryLabels: categoryEntries, subcategoryLabels: subcategoryEntries };
  }, [categories]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = buildQueryParams(filters, sortField, sortDirection, page);
        const response = await fetch(`/api/listings?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error('Məlumat yüklənə bilmədi. Yenidən cəhd edin.');
        }

        const payload: ListingQueryResult = await response.json();
        setItems(payload.items);
        setStats(payload.stats);
        setTotal(payload.total);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setErrorMessage((error as Error).message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => controller.abort();
  }, [filters, sortField, sortDirection, page]);

  const handleFiltersChange = (nextFilters: ListingFilters) => {
    setFilters(nextFilters);
    setPage(1);
  };

  const handleSortChange = (field: SortField, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <section className="space-y-8">
      <InfoBanner />
      <FiltersPanel
        categories={categories}
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />
      <StatsCards stats={stats} isLoading={isLoading} />
      <div className="rounded-3xl border border-white/10 bg-slate-900/50 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="border-b border-white/5 p-6">
          <SortBar
            sortField={sortField}
            sortDirection={sortDirection}
            total={total}
            onSortChange={handleSortChange}
          />
        </div>
        <ListingsTable
          items={items}
          isLoading={isLoading}
          errorMessage={errorMessage}
          categoryLabels={categoryLabels}
          subcategoryLabels={subcategoryLabels}
        />
        <div className="border-t border-white/5 p-6">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </div>
    </section>
  );
}

