import { spawn } from 'node:child_process';
import path from 'node:path';
import type { AdminScrapeJob, AdminScrapeRequest } from '@/lib/admin/types';
import { appendJobLog, createJobRecord, updateJobRecord } from '@/lib/admin/jobsStore';
import { uploadSnapshotToSupabase } from '@/lib/admin/supabaseIngest';

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'tapazCollector.playwright.ts');
const PROGRESS_PREFIX = '__PROGRESS__';

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

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let latestOutputPath: string | undefined;

  const handleLine = async (line: string) => {
    if (!line) {
      return;
    }
    if (line.startsWith(PROGRESS_PREFIX)) {
      try {
        const payload = JSON.parse(line.slice(PROGRESS_PREFIX.length));
        const percent = Math.min(100, payload.percent ?? (payload.total ? (payload.processed / Math.max(1, payload.total)) * 100 : 0));
        const patch: Partial<AdminScrapeJob> = {
          progress: {
            phase: payload.phase ?? 'details',
            processed: payload.processed ?? 0,
            total: payload.total ?? 0,
            percent,
            message: payload.message,
            etaSeconds: payload.etaSeconds
          }
        };
        if (payload.outputPath) {
          latestOutputPath = payload.outputPath;
          patch.outputPath = payload.outputPath;
        }
        await updateJobRecord(job.id, patch);
      } catch {
        await appendJobLog(job.id, `${line}\n`);
      }
    } else {
      await appendJobLog(job.id, `${line}\n`);
    }
  };

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString();
    let idx;
    while ((idx = stdoutBuffer.indexOf('\n')) >= 0) {
      const line = stdoutBuffer.slice(0, idx).trim();
      stdoutBuffer = stdoutBuffer.slice(idx + 1);
      void handleLine(line);
    }
  });

  child.stdout.on('end', () => {
    if (stdoutBuffer.trim()) {
      void appendJobLog(job.id, `${stdoutBuffer}\n`);
      stdoutBuffer = '';
    }
  });

  child.stderr.on('data', (chunk) => {
    stderrBuffer += chunk.toString();
    let idx;
    while ((idx = stderrBuffer.indexOf('\n')) >= 0) {
      const line = stderrBuffer.slice(0, idx);
      stderrBuffer = stderrBuffer.slice(idx + 1);
      void appendJobLog(job.id, `${line}\n`);
    }
  });

  child.stderr.on('end', () => {
    if (stderrBuffer.trim()) {
      void appendJobLog(job.id, `${stderrBuffer}\n`);
      stderrBuffer = '';
    }
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

    if (code === 0 && latestOutputPath) {
      await updateJobRecord(job.id, { supabaseSyncStatus: 'pending', supabaseSyncError: undefined });
      try {
        const result = await uploadSnapshotToSupabase(job.id, latestOutputPath);
        if (result.status === 'success') {
          await updateJobRecord(job.id, { supabaseSyncStatus: 'success' });
        } else if (result.status === 'skipped') {
          await updateJobRecord(job.id, { supabaseSyncStatus: 'idle' });
        }
      } catch (error) {
        await updateJobRecord(job.id, {
          supabaseSyncStatus: 'error',
          supabaseSyncError: (error as Error).message
        });
      }
    }
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
