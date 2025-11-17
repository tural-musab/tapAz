'use client';

import { useMemo, useState } from 'react';
import type { Category } from '@/lib/types';
import type { AdminNightlyPlanState } from '@/lib/admin/types';

interface NightlyPlanCardProps {
  categories: Category[];
  plan: AdminNightlyPlanState;
}

const tzOptions = ['Asia/Baku', 'Europe/Istanbul', 'UTC'];
const TODAY_REFERENCE = Date.now();

export const NightlyPlanCard = ({ categories, plan }: NightlyPlanCardProps) => {
  const [cronExpression, setCronExpression] = useState(plan.cronExpression);
  const [timezone, setTimezone] = useState(plan.timezone);
  const [excludedCategories, setExcludedCategories] = useState<string[]>(() => {
    const includeSet = new Set(plan.includeCategoryIds);
    const diff = categories.filter((category) => !includeSet.has(category.id)).map((category) => category.id);
    return Array.from(new Set([...plan.excludeCategoryIds, ...diff]));
  });
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveMessage, setSaveMessage] = useState('Plan hələ serverə göndərilməyib.');

  const includedCount = categories.length - excludedCategories.length;

  const handleExclusionToggle = (categoryId: string) => {
    setExcludedCategories((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      }
      return [...prev, categoryId];
    });
  };

  const handleSave = async () => {
    setSavingState('saving');
    setSaveMessage('Supabase planı yenilənir...');

    await new Promise((resolve) => setTimeout(resolve, 1200));

    setSavingState('saved');
    setSaveMessage('Mock rejim: məlumatlar `POST /api/admin/plan` endpoint-inə göndərilməyə hazırdır.');
  };

  const upcomingRun = useMemo(() => {
    const nextDate = new Date();
    nextDate.setHours(2, 0, 0, 0);
    if (nextDate.getTime() < TODAY_REFERENCE) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    return nextDate.toLocaleString('az-AZ', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
  }, []);

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Night scheduler</p>
          <h2 className="text-xl font-semibold text-white">Gecə planını idarə et</h2>
        </div>
        <div className="text-right text-sm text-slate-400">
          <p>Son yeniləmə: {new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(plan.lastUpdatedAt))}</p>
          <p className="text-xs text-slate-500">Növbəti run təxmini: {upcomingRun}</p>
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
              value={cronExpression}
              onChange={(event) => setCronExpression(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="0 2 * * *"
            />
            <p className="mt-2 text-xs text-slate-500">GitHub Actions workflow-u üçün `CRON_SCHEDULE_TIME` ilə uyğun saxlayın.</p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-white">Timezone</p>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
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
          <p className="text-xs text-slate-500">{saveMessage}</p>
        </div>
      </div>
    </section>
  );
};
