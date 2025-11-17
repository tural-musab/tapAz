import { spawn } from 'node:child_process';
import path from 'node:path';
import type { AdminScrapeJob, AdminScrapeRequest } from '@/lib/admin/types';
import { appendJobLog, createJobRecord, updateJobRecord } from '@/lib/admin/jobsStore';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'tapazCollector.playwright.ts');

export interface StartScrapeJobOptions extends AdminScrapeRequest {
  triggeredBy: string;
}

const buildEnv = (payload: AdminScrapeRequest) => ({
  ...process.env,
  SCRAPE_CATEGORY_URLS: payload.categoryUrls.join(','),
  SCRAPE_MAX_PAGES: String(payload.pageLimit),
  SCRAPE_MAX_LISTINGS: String(payload.listingLimit),
  SCRAPE_DELAY_MS: String(payload.delayMs),
  SCRAPE_DETAIL_DELAY_MS: String(payload.detailDelayMs),
  SCRAPE_HEADLESS: payload.headless ? 'true' : 'false',
  ...(payload.userAgent ? { SCRAPE_USER_AGENT: payload.userAgent } : {})
});

export const startScrapeJob = async (options: StartScrapeJobOptions): Promise<AdminScrapeJob> => {
  const job = await createJobRecord({ params: options });

  if (process.env.VERCEL) {
    return (await updateJobRecord(job.id, {
      status: 'error',
      finishedAt: new Date().toISOString(),
      errorMessage: 'Playwright toplayıcısı Vercel serverless mühitində işlədilə bilməz. Lütfən lokal mühitdə işə salın.'
    })) as AdminScrapeJob;
  }

  const child = spawn(process.execPath, [SCRIPT_PATH], {
    cwd: process.cwd(),
    env: buildEnv(options),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', async (chunk) => {
    const text = chunk.toString();
    await appendJobLog(job.id, text);
  });

  child.stderr.on('data', async (chunk) => {
    const text = chunk.toString();
    await appendJobLog(job.id, text);
  });

  child.on('spawn', async () => {
    await updateJobRecord(job.id, {
      status: 'running',
      startedAt: new Date().toISOString()
    });
  });

  child.on('close', async (code) => {
    await updateJobRecord(job.id, {
      status: code === 0 ? 'success' : 'error',
      finishedAt: new Date().toISOString(),
      errorMessage: code === 0 ? undefined : `Playwright prosesi ${code} kodu ilə dayandı`
    });
  });

  child.on('error', async (error) => {
    await appendJobLog(job.id, `Process error: ${error.message}\n`);
    await updateJobRecord(job.id, {
      status: 'error',
      finishedAt: new Date().toISOString(),
      errorMessage: error.message
    });
  });

  return job;
};
