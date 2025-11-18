import fs from 'node:fs/promises';
import path from 'node:path';
import type { AdminNightlyPlanState, CategoryStrategy, ScheduleType, Weekday } from '@/lib/admin/types';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/admin/supabaseClient';

const PLAN_FILE = path.join(process.cwd(), 'data', 'admin-nightly-plan.json');
const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_TO_CRON_INDEX: Record<Weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};
const CRON_INDEX_TO_WEEKDAY: Record<number, Weekday> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
  7: 'sun'
};

const clampHour = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 2;
  return Math.min(Math.max(value, 0), 23);
};

const clampMinute = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 59);
};

const ensureInterval = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 5;
  return Math.min(Math.max(value, 1), 120);
};

const ensureCategoryStrategy = (value?: CategoryStrategy): CategoryStrategy =>
  value === 'custom' ? 'custom' : 'all';

const ensureDaysOfWeek = (value: Weekday[], scheduleType: ScheduleType): Weekday[] => {
  if (scheduleType !== 'weekly') {
    return [];
  }
  if (!Array.isArray(value) || value.length === 0) {
    return ['mon'];
  }
  return value.filter((day): day is Weekday => WEEKDAYS.includes(day));
};

const ensureDaysOfMonth = (value: number[], scheduleType: ScheduleType): number[] => {
  if (scheduleType !== 'monthly') {
    return [];
  }
  const parsed = value
    .map((day) => Number(day))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
  if (parsed.length === 0) {
    return [1];
  }
  return parsed;
};

const DEFAULT_PLAN: AdminNightlyPlanState = {
  cronExpression: '0 2 * * *',
  timezone: 'Asia/Baku',
  scheduleType: 'daily',
  runHour: 2,
  runMinute: 0,
  daysOfWeek: [],
  daysOfMonth: [],
  categoryStrategy: 'all',
  includeCategoryIds: [],
  excludeCategoryIds: [],
  intervalMinutes: 5,
  lastUpdatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

const buildCronExpression = (plan: AdminNightlyPlanState): string => {
  const minute = clampMinute(plan.runMinute);
  const hour = clampHour(plan.runHour);

  if (plan.scheduleType === 'weekly') {
    const cronDays = ensureDaysOfWeek(plan.daysOfWeek, 'weekly')
      .map((day) => WEEKDAY_TO_CRON_INDEX[day])
      .join(',');
    return `${minute} ${hour} * * ${cronDays || WEEKDAY_TO_CRON_INDEX.mon}`;
  }

  if (plan.scheduleType === 'monthly') {
    const cronDays = ensureDaysOfMonth(plan.daysOfMonth, 'monthly').join(',');
    return `${minute} ${hour} ${cronDays || '1'} * *`;
  }

  return `${minute} ${hour} * * *`;
};

const inferPlanFromCron = (cronExpression: string) => {
  const parts = cronExpression?.trim().split(/\s+/) ?? [];
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  const dayOfMonth = parts[2];
  const dayOfWeek = parts[4];

  let scheduleType: ScheduleType = 'daily';
  let daysOfWeek: Weekday[] = [];
  let daysOfMonth: number[] = [];

  if (dayOfWeek && dayOfWeek !== '*' && dayOfWeek !== '?') {
    scheduleType = 'weekly';
    daysOfWeek = dayOfWeek
      .split(',')
      .map((value) => CRON_INDEX_TO_WEEKDAY[Number(value)])
      .filter((value): value is Weekday => Boolean(value));
  } else if (dayOfMonth && dayOfMonth !== '*' && dayOfMonth !== '?') {
    scheduleType = 'monthly';
    daysOfMonth = dayOfMonth
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 31);
  }

  return {
    scheduleType,
    runHour: clampHour(hour),
    runMinute: clampMinute(minute),
    daysOfWeek,
    daysOfMonth
  };
};

const normalizePlan = (input?: Partial<AdminNightlyPlanState>): AdminNightlyPlanState => {
  const base = input ?? {};
  const fallback = inferPlanFromCron(base.cronExpression ?? DEFAULT_PLAN.cronExpression);

  const scheduleType = base.scheduleType ?? fallback.scheduleType;
  const runHour = clampHour(base.runHour ?? fallback.runHour);
  const runMinute = clampMinute(base.runMinute ?? fallback.runMinute);
  const daysOfWeek = ensureDaysOfWeek(base.daysOfWeek ?? fallback.daysOfWeek, scheduleType);
  const daysOfMonth = ensureDaysOfMonth(base.daysOfMonth ?? fallback.daysOfMonth, scheduleType);
  const categoryStrategy = ensureCategoryStrategy(base.categoryStrategy);
  const intervalMinutes = ensureInterval(base.intervalMinutes);
  const includeCategoryIds = Array.from(new Set(base.includeCategoryIds ?? []));
  const excludeCategoryIds = Array.from(new Set(base.excludeCategoryIds ?? [])).filter(
    (categoryId) => !includeCategoryIds.includes(categoryId)
  );

  const normalized: AdminNightlyPlanState = {
    ...DEFAULT_PLAN,
    ...base,
    scheduleType,
    runHour,
    runMinute,
    daysOfWeek,
    daysOfMonth,
    categoryStrategy,
    includeCategoryIds,
    excludeCategoryIds,
    intervalMinutes,
    cronExpression: buildCronExpression({
      ...DEFAULT_PLAN,
      ...base,
      scheduleType,
      runHour,
      runMinute,
      daysOfWeek,
      daysOfMonth,
      categoryStrategy,
      includeCategoryIds,
      excludeCategoryIds,
      intervalMinutes
    }),
    lastUpdatedAt: base.lastUpdatedAt ?? DEFAULT_PLAN.lastUpdatedAt,
    updatedBy: base.updatedBy ?? DEFAULT_PLAN.updatedBy
  };

  return normalized;
};

export type PlanSource = 'supabase' | 'file';

export interface PlanPayload {
  plan: AdminNightlyPlanState;
  source: PlanSource;
}

const ensurePlanFile = async (): Promise<AdminNightlyPlanState> => {
  try {
    const raw = await fs.readFile(PLAN_FILE, 'utf8');
    return normalizePlan(JSON.parse(raw) as Partial<AdminNightlyPlanState>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.mkdir(path.dirname(PLAN_FILE), { recursive: true });
      await fs.writeFile(PLAN_FILE, JSON.stringify(DEFAULT_PLAN, null, 2), 'utf8');
      return DEFAULT_PLAN;
    }
    throw error;
  }
};

const readPlanFromFile = async (): Promise<PlanPayload> => {
  const plan = await ensurePlanFile();
  return {
    plan,
    source: 'file'
  };
};

const mapCategoryPlan = (records: Array<{ category_id: string; include: boolean; sort_order?: number | null }>) => {
  const ordered = [...records].sort((a, b) => {
    const left = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const right = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  const includeCategoryIds = ordered.filter((record) => record.include).map((record) => record.category_id);
  const excludeCategoryIds = ordered.filter((record) => !record.include).map((record) => record.category_id);
  return { includeCategoryIds, excludeCategoryIds };
};

const fetchPlanFromSupabase = async (): Promise<PlanPayload | null> => {
  if (!hasSupabaseAdmin()) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return null;
  }

  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('scheduler_settings')
      .select(
        'cron_expression, timezone, schedule_type, run_hour, run_minute, days_of_week, days_of_month, category_strategy, interval_minutes, updated_at, updated_by'
      )
      .eq('id', 'nightly')
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const { data: categories, error: categoriesError } = await supabase
      .from('category_plan')
      .select('category_id, include, sort_order')
      .order('sort_order');

    if (categoriesError) {
      throw categoriesError;
    }

    if (!settingsData || !categories) {
      return null;
    }

    const mapped = mapCategoryPlan(categories);
    const plan = normalizePlan({
      cronExpression: settingsData.cron_expression ?? DEFAULT_PLAN.cronExpression,
      timezone: settingsData.timezone ?? DEFAULT_PLAN.timezone,
      scheduleType: settingsData.schedule_type ?? DEFAULT_PLAN.scheduleType,
      runHour: settingsData.run_hour ?? DEFAULT_PLAN.runHour,
      runMinute: settingsData.run_minute ?? DEFAULT_PLAN.runMinute,
      daysOfWeek: (settingsData.days_of_week as Weekday[] | null) ?? DEFAULT_PLAN.daysOfWeek,
      daysOfMonth: (settingsData.days_of_month as number[] | null) ?? DEFAULT_PLAN.daysOfMonth,
      categoryStrategy: (settingsData.category_strategy as CategoryStrategy | null) ?? DEFAULT_PLAN.categoryStrategy,
      intervalMinutes: settingsData.interval_minutes ?? DEFAULT_PLAN.intervalMinutes,
      includeCategoryIds: mapped.includeCategoryIds,
      excludeCategoryIds: mapped.excludeCategoryIds,
      lastUpdatedAt: settingsData.updated_at ?? new Date().toISOString(),
      updatedBy: settingsData.updated_by ?? 'supabase'
    });

    return {
      plan,
      source: 'supabase'
    };
  } catch (error) {
    console.warn('Supabase plan oxunmadı', error);
    return null;
  }
};

const writePlanToFile = async (plan: AdminNightlyPlanState) => {
  await fs.mkdir(path.dirname(PLAN_FILE), { recursive: true });
  await fs.writeFile(PLAN_FILE, JSON.stringify(plan, null, 2), 'utf8');
};

const persistPlanToSupabase = async (plan: AdminNightlyPlanState) => {
  if (!hasSupabaseAdmin()) {
    return false;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return false;
  }

  try {
    const updatedAt = plan.lastUpdatedAt ?? new Date().toISOString();
    await supabase
      .from('scheduler_settings')
      .upsert({
        id: 'nightly',
        cron_expression: plan.cronExpression,
        timezone: plan.timezone,
        schedule_type: plan.scheduleType,
        run_hour: plan.runHour,
        run_minute: plan.runMinute,
        days_of_week: plan.daysOfWeek,
        days_of_month: plan.daysOfMonth,
        category_strategy: plan.categoryStrategy,
        interval_minutes: plan.intervalMinutes,
        updated_at: updatedAt,
        updated_by: plan.updatedBy ?? 'admin-panel'
      });

    const rows = [
      ...plan.includeCategoryIds.map((categoryId, index) => ({
        category_id: categoryId,
        include: true,
        sort_order: index
      })),
      ...plan.excludeCategoryIds.map((categoryId) => ({
        category_id: categoryId,
        include: false,
        sort_order: null
      }))
    ];

    if (rows.length > 0) {
      await supabase.from('category_plan').upsert(rows, { onConflict: 'category_id' });
      const categoryList = rows.map((row) => row.category_id);
      await supabase
        .from('category_plan')
        .delete()
        .not('category_id', 'in', `(${categoryList.map((id) => `'${id}'`).join(',')})`);
    } else {
      await supabase.from('category_plan').delete().neq('category_id', null);
    }

    return true;
  } catch (error) {
    console.warn('Supabase plan yazıla bilmədi', error);
    return false;
  }
};

export const loadNightlyPlan = async (): Promise<PlanPayload> => {
  const supabasePlan = await fetchPlanFromSupabase();
  if (supabasePlan) {
    return supabasePlan;
  }

  return readPlanFromFile();
};

export const persistNightlyPlan = async (
  plan: AdminNightlyPlanState,
  options?: { actor?: string }
): Promise<PlanPayload> => {
  const normalized = normalizePlan({
    ...plan,
    lastUpdatedAt: new Date().toISOString(),
    updatedBy: options?.actor ?? plan.updatedBy ?? 'admin-panel'
  });

  const savedToSupabase = await persistPlanToSupabase(normalized);
  if (!savedToSupabase) {
    await writePlanToFile(normalized);
    return { plan: normalized, source: 'file' };
  }

  return { plan: normalized, source: 'supabase' };
};
