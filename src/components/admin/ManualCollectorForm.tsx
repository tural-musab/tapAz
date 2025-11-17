'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Category } from '@/lib/types';
import type { AdminScrapeJob, AdminScrapeSelection, SupabaseSyncStatus } from '@/lib/admin/types';

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

const jobStatusTone: Record<AdminScrapeJob['status'], string> = {
  queued: 'bg-slate-800/80 text-slate-200',
  running: 'bg-amber-500/20 text-amber-200',
  success: 'bg-emerald-500/20 text-emerald-200',
  error: 'bg-rose-500/20 text-rose-200',
  idle: 'bg-slate-700/40 text-slate-200'
};

const jobStatusLabel: Record<AdminScrapeJob['status'], string> = {
  queued: 'Növbədə',
  running: 'İcra olunur',
  success: 'Tamamlandı',
  error: 'Xəta',
  idle: 'Dayandırılıb'
};

const supabaseStatusCopy: Record<SupabaseSyncStatus, string> = {
  idle: 'Supabase gözləmə rejimindədir',
  pending: 'Supabase-ə yazılır',
  success: 'Supabase sinxronu tamamlandı',
  error: 'Supabase sinxron xətası'
};

const jobTimeFormat = new Intl.DateTimeFormat('az-AZ', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const formatJobTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return jobTimeFormat.format(date);
};

const isJobActive = (job?: AdminScrapeJob | null) => job?.status === 'running' || job?.status === 'queued';

interface ManualCollectorFormProps {
  categories: Category[];
  authToken?: string;
}

export const ManualCollectorForm = ({ categories, authToken }: ManualCollectorFormProps) => {
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('Hələ job işə salınmayıb.');
  const [activeJob, setActiveJob] = useState<AdminScrapeJob | null>(null);
  const [jobHistory, setJobHistory] = useState<AdminScrapeJob[]>([]);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeProgressPercent = Math.min(
    100,
    Math.round(activeJob?.progress?.percent ?? (activeJob && isJobActive(activeJob) ? 5 : 0))
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const selectionPayload = useMemo(() => {
    const selections: AdminScrapeSelection[] = [];
    const categoryCounter = new Set<string>();

    categories.forEach((category) => {
      const isCategorySelected = selectedCategories.includes(category.id);
      const selectedSubs = category.subcategories.filter((sub) => selectedSubcategories.includes(sub.id));

      if (selectedSubs.length > 0) {
        selectedSubs.forEach((sub) => {
          selections.push({
            categoryId: category.id,
            subcategoryId: sub.id,
            label: `${category.name} → ${sub.name}`
          });
        });
        categoryCounter.add(category.id);
        return;
      }

      if (isCategorySelected) {
        selections.push({
          categoryId: category.id,
          label: category.name
        });
        categoryCounter.add(category.id);
      }
    });

    const categoryUrls = Array.from(
      new Set(
        selections.map((selection) => {
          const base = `https://tap.az/elanlar/${selection.categoryId}`;
          return selection.subcategoryId ? `${base}/${selection.subcategoryId}` : base;
        })
      )
    );

    const summary =
      selections.length === 0
        ? 'Seçim edilməyib'
        : `${categoryCounter.size} kateqoriya · ${selections.filter((item) => item.subcategoryId).length} subkateqoriya`;

    return { selections, categoryUrls, summary };
  }, [categories, selectedCategories, selectedSubcategories]);

  const buildAuthHeaders = useCallback(
    (options?: { json?: boolean }) => {
      const headers = new Headers();
      if (options?.json) {
        headers.set('Content-Type', 'application/json');
      }
      if (authToken) {
        headers.set('x-admin-token', authToken);
      }
      return headers;
    },
    [authToken]
  );

  const refreshJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/scrape', {
        headers: buildAuthHeaders()
      });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const jobs: AdminScrapeJob[] = data.jobs ?? [];
      setJobHistory(jobs);

      let nextActive: AdminScrapeJob | null = activeJob;
      if (activeJob) {
        nextActive = jobs.find((job) => job.id === activeJob.id) ?? null;
      }
      if (!nextActive) {
        nextActive = jobs.find((job) => isJobActive(job)) ?? null;
      }
      setActiveJob(nextActive);

      if (nextActive) {
        if (isJobActive(nextActive)) {
          setStatus('running');
          setStatusMessage(nextActive.progress?.message ?? 'Playwright job icra olunur...');
          setPollingJobId((current) => current ?? nextActive?.id ?? null);
        } else if (nextActive.status === 'success') {
          setStatus('success');
          setStatusMessage('Son job tamamlandı.');
        } else if (nextActive.status === 'error') {
          setStatus('error');
          setStatusMessage(nextActive.errorMessage ?? 'Job xətası baş verdi.');
        }
      }
    } catch (error) {
      console.error('Job list xətası', error);
    }
  }, [activeJob, buildAuthHeaders]);

  const fetchJobStatus = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`/api/admin/scrape/${jobId}`, {
          headers: buildAuthHeaders()
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const job: AdminScrapeJob = data.job;
        setActiveJob(job);
        if (isJobActive(job)) {
          setStatus('running');
          setStatusMessage(job.progress?.message ?? 'Playwright job icra olunur...');
        } else {
          setPollingJobId(null);
          setStatus(job.status === 'success' ? 'success' : 'error');
          setStatusMessage(
            job.status === 'success' ? 'Playwright job-u tamamlandı.' : job.errorMessage ?? 'Playwright job-u xətası.'
          );
          refreshJobs();
        }
      } catch (error) {
        console.error('Job status xətası', error);
      }
    },
    [buildAuthHeaders, refreshJobs]
  );

  useEffect(() => {
    refreshJobs();
  }, [refreshJobs]);

  useEffect(() => {
    if (!pollingJobId) {
      return;
    }

    fetchJobStatus(pollingJobId);
    const timer = setInterval(() => {
      fetchJobStatus(pollingJobId);
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchJobStatus, pollingJobId]);

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

  const selectedSummary = selectionPayload.summary;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectionPayload.categoryUrls.length === 0) {
      setStatus('error');
      setStatusMessage('Ən azı bir kateqoriya və ya subkateqoriya seçilməlidir.');
      return;
    }

    setStatus('running');
    setStatusMessage('Playwright job işə salınır...');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/scrape', {
        method: 'POST',
        headers: buildAuthHeaders({ json: true }),
        body: JSON.stringify({
          categoryUrls: selectionPayload.categoryUrls,
          selections: selectionPayload.selections,
          pageLimit: formState.pageLimit,
          listingLimit: formState.listingLimit,
          delayMs: formState.delayMs,
          detailDelayMs: formState.detailDelayMs,
          headless: formState.headless
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Server xətası baş verdi.');
      }

      const data = await response.json();
      const job: AdminScrapeJob = data.job;
      setActiveJob(job);
      setJobHistory((prev) => [job, ...prev.filter((item) => item.id !== job.id)].slice(0, 25));
      setStatus('running');
      setStatusMessage(`Job #${job.id.slice(0, 8)} növbəyə əlavə olundu.`);
      setPollingJobId(job.id);
    } catch (error) {
      setStatus('error');
      setStatusMessage((error as Error).message ?? 'Sorğu xətası baş verdi.');
    } finally {
      setIsSubmitting(false);
      refreshJobs();
    }
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
                min={250}
                step={50}
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
                min={250}
                step={50}
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
            disabled={isSubmitting || status === 'running'}
          >
            {status === 'running' ? 'İcra olunur...' : 'İndi topla'}
          </button>
          <p className="text-xs text-slate-500">
            Sorğu uğurla qəbul edildikdə Playwright skripti child-process kimi işə salınır və statusu aşağıdakı paneldə izlənə bilir.
          </p>

          {activeJob ? (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-white">Son job #{activeJob.id.slice(0, 8)}</p>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${jobStatusTone[activeJob.status]}`}>
                  {jobStatusLabel[activeJob.status]}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                URL sayı: {activeJob.params.categoryUrls.length} · Limit: {activeJob.params.pageLimit} səhifə /{' '}
                {activeJob.params.listingLimit} elan
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Başlanğıc: {formatJobTime(activeJob.startedAt)} · Bitmə: {formatJobTime(activeJob.finishedAt)}
              </p>
              {activeJob.progress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{activeJob.progress.message ?? 'İcra olunur...'}</span>
                    <span>{Math.round(activeJob.progress.percent)}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-800/80">
                    <div
                      className="h-2 rounded-full bg-emerald-500/90 transition-all"
                      style={{ width: `${activeProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}
              {activeJob.supabaseSyncStatus && (
                <p className="mt-2 text-[11px] text-slate-500">
                  Supabase: {supabaseStatusCopy[activeJob.supabaseSyncStatus]}{' '}
                  {activeJob.supabaseSyncStatus === 'error' && activeJob.supabaseSyncError ? `(${activeJob.supabaseSyncError})` : null}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800/70 bg-slate-950/20 p-4 text-xs text-slate-500">
              Hələ heç bir job işə salınmayıb.
            </div>
          )}

          {jobHistory.length > 0 && (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-950/30 p-4">
              <p className="text-sm font-semibold text-white">Son job-lar</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-400">
                {jobHistory.slice(0, 4).map((job) => (
                  <li key={job.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-300">#{job.id.slice(0, 8)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${jobStatusTone[job.status]}`}>
                      {jobStatusLabel[job.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </form>
    </section>
  );
};
