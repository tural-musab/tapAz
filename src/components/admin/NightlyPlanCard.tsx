'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category } from '@/lib/types';
import type { AdminNightlyPlanState } from '@/lib/admin/types';
import { formatDateTime } from '@/lib/formatters';

interface NightlyPlanCardProps {
  categories: Category[];
  plan: AdminNightlyPlanState;
  authToken?: string;
  source?: 'supabase' | 'file';
}

const tzOptions = ['Asia/Baku', 'Europe/Istanbul', 'UTC'];

const badgeTone = {
  supabase: 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30',
  file: 'text-amber-200 bg-amber-500/10 border border-amber-500/40'
};

export const NightlyPlanCard = ({ categories, plan: initialPlan, authToken, source: initialSource }: NightlyPlanCardProps) => {
  const [plan, setPlan] = useState(initialPlan);
  const [source, setSource] = useState<'supabase' | 'file'>(initialSource ?? 'file');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('Plan hələ serverə göndərilməyib.');
  const [loading, setLoading] = useState(false);

  const buildHeaders = useCallback(
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

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/plan', { headers: buildHeaders() });
      if (!response.ok) {
        throw new Error('Plan oxunmadı');
      }
      const data = await response.json();
      setPlan(data.plan ?? initialPlan);
      setSource(data.source ?? 'file');
    } catch (error) {
      console.error('Plan fetch xətası', error);
      setSaveMessage('Plan oxunmadı, lokal plan istifadə olunur.');
    } finally {
      setLoading(false);
    }
  }, [buildHeaders, initialPlan]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    setPlan(initialPlan);
    setSource(initialSource ?? 'file');
  }, [initialPlan, initialSource]);

  const includedCount = useMemo(() => {
    if (plan.includeCategoryIds.length > 0) {
      return plan.includeCategoryIds.length;
    }
    return categories.length - plan.excludeCategoryIds.length;
  }, [categories.length, plan.excludeCategoryIds.length, plan.includeCategoryIds.length]);

  const handleExclusionToggle = (categoryId: string) => {
    setPlan((previous) => {
      const isExcluded = previous.excludeCategoryIds.includes(categoryId);
      if (isExcluded) {
        return {
          ...previous,
          excludeCategoryIds: previous.excludeCategoryIds.filter((id) => id !== categoryId),
          includeCategoryIds: Array.from(new Set([...previous.includeCategoryIds, categoryId]))
        };
      }

      return {
        ...previous,
        excludeCategoryIds: [...previous.excludeCategoryIds, categoryId],
        includeCategoryIds: previous.includeCategoryIds.filter((id) => id !== categoryId)
      };
    });
  };

  const handlePlanFieldChange = (field: keyof Pick<AdminNightlyPlanState, 'cronExpression' | 'timezone'>, value: string) => {
    setPlan((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const excludedCategories = plan.excludeCategoryIds;

  const handleSave = async () => {
    setSavingState('saving');
    setSaveMessage('Plan saxlanılır...');

    try {
      const response = await fetch('/api/admin/plan', {
        method: 'POST',
        headers: buildHeaders({ json: true }),
        body: JSON.stringify(plan)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Plan yenilənmədi');
      }

      const data = await response.json();
      const nextPlan = (data.plan ?? plan) as AdminNightlyPlanState;
      const nextSource: 'supabase' | 'file' = data.source ?? source;
      setPlan(nextPlan);
      setSource(nextSource);
      setSavingState('saved');
      setSaveMessage(nextSource === 'supabase' ? 'Plan Supabase-də saxlandı.' : 'Plan lokal faylda saxlandı.');
    } catch (error) {
      setSavingState('error');
      setSaveMessage((error as Error).message ?? 'Xəta baş verdi');
    }
  };

  const upcomingRun = useMemo(() => {
    const parts = (plan.cronExpression ?? '').trim().split(/\s+/);
    const minute = Number(parts[0]);
    const hour = Number(parts[1]);
    const pad = (value: number) => String(value).padStart(2, '0');
    if (Number.isFinite(minute) && Number.isFinite(hour)) {
      return `${pad(hour)}:${pad(minute)} · ${plan.timezone}`;
    }
    return `${plan.cronExpression} · ${plan.timezone}`;
  }, [plan.cronExpression, plan.timezone]);

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Night scheduler</p>
          <h2 className="text-xl font-semibold text-white">Gecə planını idarə et</h2>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>Son yeniləmə: {plan.lastUpdatedAt ? formatDateTime(plan.lastUpdatedAt) : 'naməlum'}</p>
          <p className="text-xs text-slate-500">Növbəti run təxmini: {upcomingRun}</p>
          <span className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] ${badgeTone[source]}`}>
            {source === 'supabase' ? 'Supabase saxlanması' : 'Yerəl fayl rejimi'}
          </span>
          {plan.updatedBy && <p className="mt-1 text-xs text-slate-500">Yeniləyən: {plan.updatedBy}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {categories.map((category) => {
            const isExcluded = excludedCategories.includes(category.id);

            return (
              <div
                key={category.id}
                className={`rounded-xl border px-4 py-3 transition ${
                  isExcluded
                    ? 'border-slate-800/70 bg-slate-950/40 text-slate-500'
                    : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-50'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{category.name}</p>
                    <p className="text-xs text-slate-400">{category.subcategories.length} subkateqoriya</p>
                  </div>
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                      isExcluded
                        ? 'bg-slate-800/70 text-slate-300'
                        : 'bg-emerald-500/80 text-slate-900 hover:bg-emerald-400'
                    }`}
                    onClick={() => handleExclusionToggle(category.id)}
                  >
                    {isExcluded ? 'Daxil et' : 'İstisna et'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-white">Cron ifadəsi</p>
            <input
              value={plan.cronExpression}
              onChange={(event) => handlePlanFieldChange('cronExpression', event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="0 2 * * *"
            />
            <p className="mt-2 text-xs text-slate-500">GitHub Actions üçün `CRON_SCHEDULE_TIME` ilə uyğun saxlayın.</p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-white">Timezone</p>
            <select
              value={plan.timezone}
              onChange={(event) => handlePlanFieldChange('timezone', event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {tzOptions.map((option) => (
                <option key={option} value={option} className="bg-slate-900">
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 text-sm text-slate-300">
            <p>Aktiv kateqoriya sayı: {includedCount}</p>
            <p>İstisna siyahısı: {excludedCategories.length ? excludedCategories.join(', ') : 'yoxdur'}</p>
            <p>Plan statusu: {savingState === 'saved' ? 'Yadda saxlanıldı' : 'Draft'}</p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-xl bg-indigo-500/90 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={savingState === 'saving'}
          >
            {savingState === 'saving' ? 'Yenilənir...' : 'Gecə planını saxla'}
          </button>
          <p className="text-xs text-slate-500">{loading ? 'Plan yüklənir...' : saveMessage}</p>
        </div>
      </div>
    </section>
  );
};
