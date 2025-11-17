import fs from 'node:fs/promises';
import path from 'node:path';
import type { AdminNightlyPlanState } from '@/lib/admin/types';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/admin/supabaseClient';

const PLAN_FILE = path.join(process.cwd(), 'data', 'admin-nightly-plan.json');

const DEFAULT_PLAN: AdminNightlyPlanState = {
  cronExpression: '0 2 * * *',
  timezone: 'Asia/Baku',
  includeCategoryIds: [],
  excludeCategoryIds: [],
  lastUpdatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

export type PlanSource = 'supabase' | 'file';

export interface PlanPayload {
  plan: AdminNightlyPlanState;
  source: PlanSource;
}

const ensurePlanFile = async (): Promise<AdminNightlyPlanState> => {
  try {
    const raw = await fs.readFile(PLAN_FILE, 'utf8');
    return JSON.parse(raw) as AdminNightlyPlanState;
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

const mapCategoryPlan = (records: Array<{ category_id: string; include: boolean }>) => {
  const includeCategoryIds = records.filter((record) => record.include).map((record) => record.category_id);
  const excludeCategoryIds = records.filter((record) => !record.include).map((record) => record.category_id);
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
      .select('cron_expression, timezone, updated_at, updated_by')
      .eq('id', 'nightly')
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const { data: categories, error: categoriesError } = await supabase
      .from('category_plan')
      .select('category_id, include')
      .order('category_id');

    if (categoriesError) {
      throw categoriesError;
    }

    if (!settingsData || !categories) {
      return null;
    }

    const mapped = mapCategoryPlan(categories);

    return {
      plan: {
        cronExpression: settingsData.cron_expression ?? DEFAULT_PLAN.cronExpression,
        timezone: settingsData.timezone ?? DEFAULT_PLAN.timezone,
        includeCategoryIds: mapped.includeCategoryIds,
        excludeCategoryIds: mapped.excludeCategoryIds,
        lastUpdatedAt: settingsData.updated_at ?? new Date().toISOString(),
        updatedBy: settingsData.updated_by ?? 'supabase'
      },
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
        updated_at: updatedAt,
        updated_by: plan.updatedBy ?? 'admin-panel'
      });

    const rows = [
      ...plan.includeCategoryIds.map((categoryId) => ({ category_id: categoryId, include: true })),
      ...plan.excludeCategoryIds.map((categoryId) => ({ category_id: categoryId, include: false }))
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
  const includeSet = new Set(plan.includeCategoryIds);
  plan.excludeCategoryIds.forEach((id) => includeSet.delete(id));

  const nextPlan: AdminNightlyPlanState = {
    ...plan,
    includeCategoryIds: Array.from(includeSet),
    excludeCategoryIds: Array.from(new Set(plan.excludeCategoryIds)),
    lastUpdatedAt: new Date().toISOString(),
    updatedBy: options?.actor ?? plan.updatedBy ?? 'admin-panel'
  };

  const savedToSupabase = await persistPlanToSupabase(nextPlan);
  if (!savedToSupabase) {
    await writePlanToFile(nextPlan);
    return { plan: nextPlan, source: 'file' };
  }

  return { plan: nextPlan, source: 'supabase' };
};
