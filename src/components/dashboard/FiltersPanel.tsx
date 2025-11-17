"use client";

import { useMemo } from 'react';
import clsx from 'clsx';
import { Category, ListingFilters } from '@/lib/types';
import { Search } from 'lucide-react';

interface FiltersPanelProps {
  categories: Category[];
  filters: ListingFilters;
  hasActiveFilters: boolean;
  onChange: (filters: ListingFilters) => void;
  onReset: () => void;
}

const inputClassName =
  'w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400';

const pillButtonClassName =
  'rounded-full border px-4 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-300 focus-visible:ring-offset-slate-950';

export default function FiltersPanel({ categories, filters, hasActiveFilters, onChange, onReset }: FiltersPanelProps) {
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === filters.categoryId),
    [categories, filters.categoryId]
  );

  const subcategories = selectedCategory?.subcategories ?? [];

  const handleFieldChange = <Key extends keyof ListingFilters>(key: Key, value: ListingFilters[Key]) => {
    const nextFilters: ListingFilters = { ...filters, [key]: value };
    if (key === 'categoryId') {
      nextFilters.subcategoryId = undefined;
    }
    if (key === 'query' && typeof value === 'string') {
      nextFilters.query = value.trim() === '' ? undefined : value;
    }
    onChange(nextFilters);
  };

  const handleNumericInput = (key: keyof ListingFilters) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    handleFieldChange(key, value === '' ? undefined : Number(value));
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-5">
          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
              <Search className="size-4 text-sky-300" />
              Açar sözlə axtar
            </label>
            <input
              type="text"
              value={filters.query ?? ''}
              placeholder="Məhsul adı, model və ya satıcı"
              onChange={(event) => handleFieldChange('query', event.target.value)}
              className={inputClassName}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">Kateqoriya</label>
              <select
                value={filters.categoryId ?? ''}
                onChange={(event) => handleFieldChange('categoryId', event.target.value || undefined)}
                className={inputClassName}
              >
                <option value="">Hamısı</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {selectedCategory?.note && (
                <p className="mt-1 text-xs text-white/60">{selectedCategory.note}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">
                Subkateqoriya
              </label>
              <select
                value={filters.subcategoryId ?? ''}
                onChange={(event) => handleFieldChange('subcategoryId', event.target.value || undefined)}
                disabled={!filters.categoryId}
                className={clsx(
                  inputClassName,
                  !filters.categoryId && 'cursor-not-allowed border-white/10 bg-white/5 text-white/40'
                )}
              >
                <option value="">Hamısı</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">
                Qiymət aralığı (AZN)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  value={filters.minPrice ?? ''}
                  placeholder="min"
                  onChange={handleNumericInput('minPrice')}
                  className={inputClassName}
                />
                <input
                  type="number"
                  min={0}
                  value={filters.maxPrice ?? ''}
                  placeholder="max"
                  onChange={handleNumericInput('maxPrice')}
                  className={inputClassName}
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">
                Baxış sayı aralığı
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  value={filters.minViews ?? ''}
                  placeholder="min"
                  onChange={handleNumericInput('minViews')}
                  className={inputClassName}
                />
                <input
                  type="number"
                  min={0}
                  value={filters.maxViews ?? ''}
                  placeholder="max"
                  onChange={handleNumericInput('maxViews')}
                  className={inputClassName}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="w-full max-w-sm space-y-5">
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">Məhsul durumu</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: undefined, label: 'Hamısı' },
                { value: true, label: 'Yeni' },
                { value: false, label: 'İşlənmiş' }
              ].map((option) => (
                <button
                  key={String(option.value ?? 'all')}
                  type="button"
                  onClick={() => handleFieldChange('isNew', option.value as boolean | undefined)}
                  className={clsx(
                    pillButtonClassName,
                    filters.isNew === option.value
                      ? 'border-sky-400 bg-sky-400/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">Satıcı tipi</span>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Hamısı' },
                { value: 'store', label: 'Mağaza' },
                { value: 'individual', label: 'Fərdi' }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleFieldChange('sellerType', option.value as ListingFilters['sellerType'])}
                  className={clsx(
                    pillButtonClassName,
                    filters.sellerType === option.value
                      ? 'border-emerald-400 bg-emerald-400/20 text-white'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/70">Şəhər</label>
            <input
              type="text"
              placeholder="Bakı, Sumqayıt..."
              value={filters.city ?? ''}
              onChange={(event) => handleFieldChange('city', event.target.value || undefined)}
              className={inputClassName}
            />
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters}
            className={clsx(
              'w-full rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition',
              hasActiveFilters
                ? 'text-white hover:border-white/40 hover:bg-white/10'
                : 'cursor-not-allowed text-white/40'
            )}
          >
            Filtrləri sıfırla
          </button>
        </div>
      </div>
    </div>
  );
}

