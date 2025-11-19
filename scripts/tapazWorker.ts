import 'dotenv/config';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DateTime } from 'luxon';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const COLLECTOR_SCRIPT = path.join(process.cwd(), 'scripts', 'tapazCollector.playwright.ts');
const UPLOAD_SCRIPT = path.join(process.cwd(), 'scripts', 'uploadSnapshotToSupabase.ts');

type Nullable<T> = T | null;

interface ScrapePlanRecord {
  id: string;
  name: string;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'once';
  timezone: string;
  run_hour: number;
  run_minute: number;
  days_of_week: number[];
  days_of_month: number[];
  once_run_at: Nullable<string>;
  delay_between_categories_seconds: number;
  max_pages: number;
  max_listings: number;
  enabled: boolean;
  next_run_at: Nullable<string>;
  last_run_at: Nullable<string>;
  metadata: Nullable<PlanMetadata>;
}

interface ScrapePlanCategory {
  plan_id: string;
  category_slug: string;
  include_subcategories: boolean;
  order_index: number;
}

type PlanMetadata = {
  scrape?: {
    pageDelayMs?: number;
    detailDelayMs?: number;
    headless?: boolean;
    userAgent?: string;
  };
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL və SUPABASE_SERVICE_ROLE_KEY mühit dəyişənləri tələb olunur.');
  }

  return createClient(url, serviceKey);
};

const fetchDuePlans = async (client: SupabaseClient): Promise<ScrapePlanRecord[]> => {
  const { data, error } = await client
    .from('scrape_plans')
    .select(
      `
      id,
      name,
      schedule_type,
      timezone,
      run_hour,
      run_minute,
      days_of_week,
      days_of_month,
      once_run_at,
      delay_between_categories_seconds,
      max_pages,
      max_listings,
      enabled,
      next_run_at,
      last_run_at,
      metadata
    `
    )
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .lte('next_run_at', new Date().toISOString());

  if (error) {
    throw new Error(`scrape_plans oxunmadı: ${error.message}`);
  }

  return (data ?? []) as ScrapePlanRecord[];
};

const fetchPlanCategories = async (client: SupabaseClient, planId: string): Promise<ScrapePlanCategory[]> => {
  const { data, error } = await client
    .from('scrape_plan_categories')
    .select(
      `
      plan_id,
      category_slug,
      include_subcategories,
      order_index
    `
    )
    .eq('plan_id', planId)
    .order('order_index', { ascending: true });

  if (error) {
    throw new Error(`Plan kateqoriyaları oxunmadı (${planId}): ${error.message}`);
  }

  return (data ?? []) as ScrapePlanCategory[];
};

const insertScrapeRun = async (client: SupabaseClient, planId: string, jobId: string) => {
  const { data, error } = await client
    .from('scrape_runs')
    .insert({
      plan_id: planId,
      job_id: jobId,
      status: 'running'
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`scrape_runs insert xətası: ${error.message}`);
  }

  return data.id as string;
};

const updateScrapeRun = async (
  client: SupabaseClient,
  runId: string,
  patch: Partial<{
    status: string;
    error_message?: string;
    finished_at?: string;
    listings_count?: number;
    snapshot_path?: string | null;
  }>
) => {
  const { error } = await client
    .from('scrape_runs')
    .update({
      ...patch,
      finished_at: patch.finished_at ?? new Date().toISOString()
    })
    .eq('id', runId);

  if (error) {
    console.error('scrape_runs güncəllənmədi', error.message);
  }
};

const runChildScript = (
  scriptPath: string,
  args: string[],
  env: Record<string, string | undefined>
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });

const runCollectorForCategory = async (
  plan: ScrapePlanRecord,
  categoryUrl: string,
  jobId: string,
  metadata: PlanMetadata
) => {
  const collectorEnv: Record<string, string> = {
    SCRAPE_CATEGORY_URLS: categoryUrl,
    SCRAPE_MAX_PAGES: String(plan.max_pages ?? 1),
    SCRAPE_MAX_LISTINGS: String(plan.max_listings ?? 120),
    SCRAPE_DELAY_MS: String(metadata.scrape?.pageDelayMs ?? 1500),
    SCRAPE_DETAIL_DELAY_MS: String(metadata.scrape?.detailDelayMs ?? 2200),
    SCRAPE_HEADLESS: metadata.scrape?.headless === false ? 'false' : 'true',
    SCRAPE_JOB_ID: jobId
  };

  if (metadata.scrape?.userAgent) {
    collectorEnv.SCRAPE_USER_AGENT = metadata.scrape.userAgent;
  }

  const result = await runChildScript(COLLECTOR_SCRIPT, [], collectorEnv);

  if (result.code !== 0) {
    throw new Error(`Collector xətası (${categoryUrl}): ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout.split('\n').map((line) => line.trim());
  let snapshotPath: string | undefined;
  for (const line of lines) {
    if (line.startsWith('__PROGRESS__')) {
      try {
        const payload = JSON.parse(line.replace('__PROGRESS__', ''));
        if (payload.outputPath) {
          snapshotPath = payload.outputPath as string;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!snapshotPath) {
    const match = result.stdout.match(/tapaz-live-[^\s]+\.json/);
    snapshotPath = match ? path.join(process.cwd(), match[0]) : undefined;
  }

  if (!snapshotPath) {
    throw new Error('Snapshot faylı tapılmadı.');
  }

  return snapshotPath;
};

const uploadSnapshot = async (snapshotPath: string, jobId: string) => {
  const result = await runChildScript(UPLOAD_SCRIPT, [snapshotPath, jobId], {});
  if (result.code !== 0) {
    throw new Error(`Snapshot upload xətası: ${result.stderr || result.stdout}`);
  }
};

const countSnapshotListings = async (snapshotPath: string) => {
  try {
    const raw = await fs.readFile(snapshotPath, 'utf8');
    const parsed = JSON.parse(raw) as { items?: unknown[] };
    return Array.isArray(parsed.items) ? parsed.items.length : 0;
  } catch (error) {
    console.warn('Snapshot oxunmadı, count=0', error);
    return 0;
  }
};

const buildCategoryUrls = (categories: ScrapePlanCategory[]) =>
  categories.map((category) => `https://tap.az/elanlar/${category.category_slug}`);

const calculateNextRunAt = (plan: ScrapePlanRecord) => {
  if (plan.schedule_type === 'once') {
    return null;
  }

  const zone = plan.timezone || 'UTC';
  const now = DateTime.now().setZone(zone);
  let next = DateTime.fromObject(
    {
      hour: plan.run_hour,
      minute: plan.run_minute,
      second: 0,
      millisecond: 0
    },
    { zone }
  );

  switch (plan.schedule_type) {
    case 'daily': {
      if (next <= now) {
        next = next.plus({ days: 1 });
      }
      return next.toUTC().toISO();
    }
    case 'weekly': {
      const days = (plan.days_of_week ?? []).length > 0 ? plan.days_of_week : [now.weekday % 7];
      const sorted = [...days].sort((a, b) => a - b);
      for (let offset = 0; offset <= 7; offset += 1) {
        const candidate = next.plus({ days: offset });
        const weekday = ((candidate.weekday % 7) + 6) % 7; // convert to 0(Sun) - 6(Sat)
        if (sorted.includes(weekday) && candidate > now) {
          return candidate.toUTC().toISO();
        }
      }
      return next.plus({ weeks: 1 }).toUTC().toISO();
    }
    case 'monthly': {
      const days = (plan.days_of_month ?? []).length > 0 ? plan.days_of_month : [1];
      const sorted = [...days].sort((a, b) => a - b);
      const maxAttempts = 62;
      let candidate = next;
      let attempts = 0;
      while (attempts < maxAttempts) {
        const day = candidate.day;
        if (sorted.includes(day) && candidate > now) {
          return candidate.toUTC().toISO();
        }
        candidate = candidate.plus({ days: 1 }).set({ hour: plan.run_hour, minute: plan.run_minute, second: 0, millisecond: 0 });
        attempts += 1;
      }
      return candidate.toUTC().toISO();
    }
    default:
      return next.plus({ days: 1 }).toUTC().toISO();
  }
};

const runPlan = async (client: SupabaseClient, plan: ScrapePlanRecord) => {
  const categories = await fetchPlanCategories(client, plan.id);
  if (categories.length === 0) {
    console.log(`Plan ${plan.name} (${plan.id}) kateqoriya tapmadı, atlanır.`);
    const nextRunAt = calculateNextRunAt(plan);
    if (nextRunAt) {
      await client.from('scrape_plans').update({ next_run_at: nextRunAt }).eq('id', plan.id);
    }
    return;
  }

  const metadata: PlanMetadata = plan.metadata ?? {};
  const jobId = `tapaz-${plan.id}-${Date.now()}`;
  const runId = await insertScrapeRun(client, plan.id, jobId);

  let listingsCount = 0;
  let lastSnapshotPath: string | null = null;
  let runStatus: 'success' | 'error' = 'success';
  let errorMessage: string | undefined;

  try {
    const categoryUrls = buildCategoryUrls(categories);
    for (const [index, categoryUrl] of categoryUrls.entries()) {
      console.log(`[plan ${plan.name}] Kateqoriya işlənir: ${categoryUrl}`);
      const snapshotPath = await runCollectorForCategory(plan, categoryUrl, jobId, metadata);
      await uploadSnapshot(snapshotPath, jobId);
      const added = await countSnapshotListings(snapshotPath);
      listingsCount += added;
      lastSnapshotPath = snapshotPath;

      const isLast = index === categoryUrls.length - 1;
      if (!isLast) {
        const waitMs = Math.max(0, (plan.delay_between_categories_seconds ?? 0) * 1000);
        if (waitMs > 0) {
          await delay(waitMs);
        }
      }
    }
  } catch (error) {
    runStatus = 'error';
    errorMessage = (error as Error).message;
    console.error(`Plan ${plan.name} xətası:`, error);
  } finally {
    await updateScrapeRun(client, runId, {
      status: runStatus,
      error_message: errorMessage,
      listings_count: listingsCount,
      snapshot_path: lastSnapshotPath
    });
  }

  const nextRunAt = calculateNextRunAt(plan);
  await client
    .from('scrape_plans')
    .update({
      next_run_at: nextRunAt,
      last_run_at: new Date().toISOString()
    })
    .eq('id', plan.id);
};

export const runWorker = async () => {
  const supabase = getSupabaseClient();
  const plans = await fetchDuePlans(supabase);

  if (plans.length === 0) {
    console.log('İcra olunacaq plan tapılmadı.');
    return;
  }

  for (const plan of plans) {
    await runPlan(supabase, plan);
  }
};

if (require.main === module) {
  runWorker().catch((error) => {
    console.error('Worker failed', error);
    process.exit(1);
  });
}
