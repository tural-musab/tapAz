'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category } from '@/lib/types';
import type { AdminNightlyPlanState, CategoryStrategy, ScheduleType, Weekday } from '@/lib/admin/types';
import { formatDateTime } from '@/lib/formatters';

interface NightlyPlanCardProps {
  categories: Category[];
  plan: AdminNightlyPlanState;
  authToken?: string;
  source?: 'supabase' | 'file';
}

const tzOptions = ['Asia/Baku', 'Europe/Istanbul', 'UTC'];
const scheduleLabels: Record<ScheduleType, string> = {
  daily: 'Hər gün',
  weekly: 'Həftəlik',
  monthly: 'Aylıq'
};

const weekdayLabels: Record<Weekday, string> = {
  mon: 'B.e',
  tue: 'Ç.a',
  wed: 'Ç',
  thu: 'C.a',
  fri: 'C',
  sat: 'Ş',
  sun: 'B'
};

const badgeTone = {
  supabase: 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30',
  file: 'text-amber-200 bg-amber-500/10 border border-amber-500/40'
};

const pad = (value: number) => String(value).padStart(2, '0');

const formatTime = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

export const NightlyPlanCard = ({ categories, plan: initialPlan, authToken, source: initialSource }: NightlyPlanCardProps) => {
  const [plan, setPlan] = useState(initialPlan);
  const [source, setSource] = useState<'supabase' | 'file'>(initialSource ?? 'file');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('Plan hələ serverə göndərilməyib.');
  const [loading, setLoading] = useState(false);
  const [monthlyInput, setMonthlyInput] = useState(plan.daysOfMonth.join(', '));

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
      setMonthlyInput((data.plan?.daysOfMonth ?? []).join(', '));
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
    setMonthlyInput(initialPlan.daysOfMonth.join(', '));
    setSource(initialSource ?? 'file');
  }, [initialPlan, initialSource]);

  const includedCount = useMemo(() => {
    if (plan.categoryStrategy === 'all') {
      return categories.length - plan.excludeCategoryIds.length;
    }
    return plan.includeCategoryIds.length;
  }, [categories.length, plan.categoryStrategy, plan.excludeCategoryIds.length, plan.includeCategoryIds.length]);

  const selectedCategories = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return plan.includeCategoryIds.map((id) => map.get(id)).filter((category): category is Category => Boolean(category));
  }, [categories, plan.includeCategoryIds]);

  const availableCategories = useMemo(
    () => categories.filter((category) => !plan.includeCategoryIds.includes(category.id)),
    [categories, plan.includeCategoryIds]
  );

  const handleScheduleTypeChange = (value: ScheduleType) => {
    setPlan((previous) => ({
      ...previous,
      scheduleType: value,
      daysOfWeek: value === 'weekly' ? previous.daysOfWeek ?? ['mon'] : [],
      daysOfMonth: value === 'monthly' ? previous.daysOfMonth ?? [1] : []
    }));
  };

  const handleTimeChange = (value: string) => {
    const [hourString, minuteString] = value.split(':');
    const hour = Number(hourString);
    const minute = Number(minuteString);
    setPlan((previous) => ({
      ...previous,
      runHour: Number.isFinite(hour) ? hour : previous.runHour,
      runMinute: Number.isFinite(minute) ? minute : previous.runMinute
    }));
  };

  const handleTimezoneChange = (value: string) => {
    setPlan((previous) => ({
      ...previous,
      timezone: value
    }));
  };

  const toggleWeekday = (weekday: Weekday) => {
    setPlan((previous) => {
      const exists = previous.daysOfWeek.includes(weekday);
      const nextDays = exists
        ? previous.daysOfWeek.filter((day) => day !== weekday)
        : [...previous.daysOfWeek, weekday];
      return {
        ...previous,
        daysOfWeek: nextDays
      };
    });
  };

  const handleMonthlyDaysChange = (value: string) => {
    setMonthlyInput(value);
    const parsed = value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item >= 1 && item <= 31);
    setPlan((previous) => ({
      ...previous,
      daysOfMonth: parsed
    }));
  };

  const handleIntervalChange = (value: number) => {
    setPlan((previous) => ({
      ...previous,
      intervalMinutes: Number.isFinite(value) ? value : previous.intervalMinutes
    }));
  };

  const handleStrategyChange = (value: CategoryStrategy) => {
    setPlan((previous) => {
      if (value === 'all') {
        return {
          ...previous,
          categoryStrategy: value,
          excludeCategoryIds: previous.excludeCategoryIds,
          includeCategoryIds: []
        };
      }
      const defaultSelection = previous.includeCategoryIds.length > 0 ? previous.includeCategoryIds : categories.slice(0, 1).map((category) => category.id);
      return {
        ...previous,
        categoryStrategy: value,
        includeCategoryIds: defaultSelection,
        excludeCategoryIds: []
      };
    });
  };

  const handleExclusionToggle = (categoryId: string) => {
    setPlan((previous) => {
      const isExcluded = previous.excludeCategoryIds.includes(categoryId);
      if (isExcluded) {
        return {
          ...previous,
          excludeCategoryIds: previous.excludeCategoryIds.filter((id) => id !== categoryId)
        };
      }

      return {
        ...previous,
        excludeCategoryIds: [...previous.excludeCategoryIds, categoryId]
      };
    });
  };

  const addCategoryToCustomPlan = (categoryId: string) => {
    setPlan((previous) => {
      if (previous.includeCategoryIds.includes(categoryId)) {
        return previous;
      }
      return {
        ...previous,
        includeCategoryIds: [...previous.includeCategoryIds, categoryId]
      };
    });
  };

  const moveCategoryInOrder = (categoryId: string, direction: -1 | 1) => {
    setPlan((previous) => {
      const index = previous.includeCategoryIds.indexOf(categoryId);
      if (index === -1) {
        return previous;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= previous.includeCategoryIds.length) {
        return previous;
      }
      const nextOrder = [...previous.includeCategoryIds];
      [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
      return {
        ...previous,
        includeCategoryIds: nextOrder
      };
    });
  };

  const removeCategoryFromOrder = (categoryId: string) => {
    setPlan((previous) => ({
      ...previous,
      includeCategoryIds: previous.includeCategoryIds.filter((id) => id !== categoryId)
    }));
  };

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
      setMonthlyInput(nextPlan.daysOfMonth.join(', '));
      setSource(nextSource);
      setSavingState('saved');
      setSaveMessage(nextSource === 'supabase' ? 'Plan Supabase-də saxlandı.' : 'Plan lokal faylda saxlandı.');
    } catch (error) {
      setSavingState('error');
      setSaveMessage((error as Error).message ?? 'Xəta baş verdi');
    }
  };

  const upcomingRun = useMemo(() => `${formatTime(plan.runHour, plan.runMinute)} · ${plan.timezone}`, [plan.runHour, plan.runMinute, plan.timezone]);

  const renderWeekdaySelector = () => (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-widest text-slate-400">Həftənin günləri</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(weekdayLabels).map(([key, label]) => {
          const value = key as Weekday;
          const isActive = plan.daysOfWeek.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleWeekday(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                isActive ? 'bg-emerald-500/80 text-slate-950' : 'border border-slate-700 text-slate-300'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMonthlyInput = () => (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-widest text-slate-400">Ay günləri</p>
      <input
        value={monthlyInput}
        onChange={(event) => handleMonthlyDaysChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        placeholder="1, 15, 30"
      />
      <p className="mt-1 text-xs text-slate-500">Vergüllə ayırın, 1-31 arası dəyərlər qəbul olunur.</p>
    </div>
  );

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Zamanlayıcı</p>
          <h2 className="text-xl font-semibold text-white">Planlaşdırılmış toplama</h2>
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <label className="text-sm font-semibold text-white">Plan tipi</label>
            <select
              value={plan.scheduleType}
              onChange={(event) => handleScheduleTypeChange(event.target.value as ScheduleType)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {Object.entries(scheduleLabels).map(([value, label]) => (
                <option key={value} value={value} className="bg-slate-900">
                  {label}
                </option>
              ))}
            </select>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Saat</p>
                <input
                  type="time"
                  value={formatTime(plan.runHour, plan.runMinute)}
                  onChange={(event) => handleTimeChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Timezone</p>
                <select
                  value={plan.timezone}
                  onChange={(event) => handleTimezoneChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  {tzOptions.map((option) => (
                    <option key={option} value={option} className="bg-slate-900">
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {plan.scheduleType === 'weekly' && renderWeekdaySelector()}
            {plan.scheduleType === 'monthly' && renderMonthlyInput()}

            <div className="mt-4">
              <p className="text-xs uppercase tracking-widest text-slate-400">Kateqoriyalararası gecikmə</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={plan.intervalMinutes}
                  onChange={(event) => handleIntervalChange(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                />
                <span className="text-xs text-slate-500">dəq</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 text-sm text-slate-300">
            <p>Aktiv kateqoriya sayı: {includedCount}</p>
            <p>Plan statusu: {savingState === 'saved' ? 'Yadda saxlanıldı' : 'Draft'}</p>
            <p>Interval: {plan.intervalMinutes} dəqiqə</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
            <p className="text-sm font-semibold text-white">Kateqoriya rejimi</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-white">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="category-strategy"
                  value="all"
                  checked={plan.categoryStrategy === 'all'}
                  onChange={(event) => handleStrategyChange(event.target.value as CategoryStrategy)}
                />
                Bütün kateqoriyalar
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="category-strategy"
                  value="custom"
                  checked={plan.categoryStrategy === 'custom'}
                  onChange={(event) => handleStrategyChange(event.target.value as CategoryStrategy)}
                />
                Xüsusi seçim
              </label>
            </div>

            {plan.categoryStrategy === 'all' ? (
              <div className="mt-4 space-y-3">
                {categories.map((category) => {
                  const isExcluded = plan.excludeCategoryIds.includes(category.id);
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
                            isExcluded ? 'bg-slate-800/70 text-slate-300' : 'bg-emerald-500/80 text-slate-900 hover:bg-emerald-400'
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
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Seçilmiş sıra</p>
                  {selectedCategories.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Ən az bir kateqoriya əlavə edin.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {selectedCategories.map((category, index) => (
                        <div key={category.id} className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                          <div>
                            <p className="font-semibold">{index + 1}. {category.name}</p>
                            <p className="text-xs text-slate-500">{category.subcategories.length} subkateqoriya</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <button type="button" onClick={() => moveCategoryInOrder(category.id, -1)} className="rounded bg-slate-800 px-2 py-1">↑</button>
                            <button type="button" onClick={() => moveCategoryInOrder(category.id, 1)} className="rounded bg-slate-800 px-2 py-1">↓</button>
                            <button type="button" onClick={() => removeCategoryFromOrder(category.id)} className="rounded bg-rose-500/20 px-2 py-1 text-rose-200">Sil</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Mövcud kateqoriyalar</p>
                  <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1 text-sm text-slate-200">
                    {availableCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => addCategoryToCustomPlan(category.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-left transition hover:border-emerald-500/60"
                      >
                        <span>{category.name}</span>
                        <span className="text-xs text-slate-500">{category.subcategories.length} sub</span>
                      </button>
                    ))}
                    {availableCategories.length === 0 && <p className="text-xs text-slate-500">Bütün kateqoriyalar əlavə olunub.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-xl bg-indigo-500/90 px-4 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={savingState === 'saving'}
          >
            {savingState === 'saving' ? 'Yenilənir...' : 'Planı saxla'}
          </button>
          <p className="text-xs text-slate-500">{loading ? 'Plan yüklənir...' : saveMessage}</p>
        </div>
      </div>
    </section>
  );
};
