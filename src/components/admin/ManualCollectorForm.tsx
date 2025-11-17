'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Category } from '@/lib/types';

const DEFAULT_FORM = {
  pageLimit: 2,
  listingLimit: 120,
  delayMs: 1500,
  detailDelayMs: 2200,
  headless: true
};

const statusStyles: Record<'idle' | 'running' | 'success' | 'error', string> = {
  idle: 'text-slate-300',
  running: 'text-amber-300',
  success: 'text-emerald-300',
  error: 'text-rose-300'
};

interface ManualCollectorFormProps {
  categories: Category[];
}

export const ManualCollectorForm = ({ categories }: ManualCollectorFormProps) => {
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Hələ job işə salınmayıb.');

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const handleCategoryToggle = (category: Category) => {
    const isSelected = selectedCategories.includes(category.id);

    if (isSelected) {
      setSelectedCategories((prev) => prev.filter((id) => id !== category.id));
      setSelectedSubcategories((prev) =>
        prev.filter((subId) => !category.subcategories.some((sub) => sub.id === subId))
      );
      return;
    }

    setSelectedCategories((prev) => [...prev, category.id]);
    setSelectedSubcategories((prev) => {
      const set = new Set(prev);
      category.subcategories.forEach((sub) => set.add(sub.id));
      return Array.from(set);
    });
  };

  const handleSubcategoryToggle = (categoryId: string, subcategoryId: string) => {
    const isSelected = selectedSubcategories.includes(subcategoryId);

    if (isSelected) {
      setSelectedSubcategories((prev) => {
        const nextSelection = prev.filter((id) => id !== subcategoryId);
        const siblings = categoryMap.get(categoryId)?.subcategories ?? [];
        const hasSiblingStillSelected = siblings.some((sub) => nextSelection.includes(sub.id));

        if (!hasSiblingStillSelected) {
          setSelectedCategories((prevCategories) => prevCategories.filter((id) => id !== categoryId));
        }

        return nextSelection;
      });
      return;
    }

    setSelectedSubcategories((prev) => [...prev, subcategoryId]);

    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev;
      }
      return [...prev, categoryId];
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;

    setFormState((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : Number(value)
    }));
  };

  const selectedSummary = useMemo(() => {
    const subCount = selectedSubcategories.length;
    const catCount = selectedCategories.length;

    if (!subCount) {
      return 'Seçim edilməyib';
    }

    return `${catCount} kateqoriya · ${subCount} subkateqoriya`;
  }, [selectedCategories.length, selectedSubcategories.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedSubcategories.length === 0) {
      setStatus('error');
      setStatusMessage('Ən azı bir subkateqoriya seçilməlidir.');
      return;
    }

    setStatus('running');
    setStatusMessage('Playwright job hazırlanır...');

    await new Promise((resolve) => setTimeout(resolve, 1200));

    setStatus('success');
    setStatusMessage('Mock rejim: parametr paketiniz server API-sinə ötürülməyə hazırdır.');
  };

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Manual collector</p>
          <h2 className="text-xl font-semibold text-white">Kateqoriya seçimi və Playwright parametrləri</h2>
        </div>
        <p className={`text-sm font-medium ${statusStyles[status]}`}>{statusMessage}</p>
      </div>

      <form className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]" onSubmit={handleSubmit}>
        <div className="space-y-4">
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.id);

            return (
              <div key={category.id} className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{category.name}</p>
                    {category.note && <p className="text-sm text-slate-400">{category.note}</p>}
                  </div>
                  <button
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                      isSelected
                        ? 'border-emerald-400/70 text-emerald-200'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                    onClick={() => handleCategoryToggle(category)}
                  >
                    {isSelected ? 'Hamısını çıxar' : 'Hamısını seç'}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {category.subcategories.map((sub) => (
                    <label
                      key={sub.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                        selectedSubcategories.includes(sub.id)
                          ? 'border-emerald-500/60 bg-emerald-500/5 text-emerald-100'
                          : 'border-slate-800/70 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-600 bg-slate-900 text-emerald-400 focus:ring-emerald-400"
                        checked={selectedSubcategories.includes(sub.id)}
                        onChange={() => handleSubcategoryToggle(category.id, sub.id)}
                      />
                      <span>{sub.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4">
            <p className="text-sm font-semibold text-white">Seçilənlər</p>
            <p className="mt-1 text-sm text-slate-400">{selectedSummary}</p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-4 space-y-4">
            <label className="block text-sm text-slate-300">
              Səhifə limiti
              <input
                type="number"
                min={1}
                max={10}
                name="pageLimit"
                value={formState.pageLimit}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Elan limiti
              <input
                type="number"
                min={10}
                max={1000}
                step={10}
                name="listingLimit"
                value={formState.listingLimit}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Kateqoriya gecikməsi (ms)
              <input
                type="number"
                min={500}
                step={100}
                name="delayMs"
                value={formState.delayMs}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Detal səhifəsi gecikməsi (ms)
              <input
                type="number"
                min={500}
                step={100}
                name="detailDelayMs"
                value={formState.detailDelayMs}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="headless"
                checked={formState.headless}
                onChange={handleInputChange}
                className="size-4 rounded border-slate-600 bg-slate-950 text-emerald-400 focus:ring-emerald-500"
              />
              Headless rejimdə işlət
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500/90 px-4 py-3 text-center text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={status === 'running'}
          >
            {status === 'running' ? 'İcra olunur...' : 'İndi topla'}
          </button>
          <p className="text-xs text-slate-500">
            Bu mərhələdə düymə yalnız mock cavab qaytarır. `POST /api/admin/scrape` endpoint-i növbəti mərhələdə birləşdiriləcək.
          </p>
        </div>
      </form>
    </section>
  );
};
