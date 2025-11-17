import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AdminJobStatus, AdminScrapeJob, AdminScrapeRequest } from '@/lib/admin/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_FILE = path.join(DATA_DIR, 'admin-jobs.json');
const LOG_DIR = path.join(DATA_DIR, 'admin-job-logs');

const ensureDirs = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
};

const createCorruptedBackup = async (raw: string) => {
  try {
    await ensureDirs();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(DATA_DIR, `admin-jobs-corrupted-${timestamp}.json`);
    await fs.writeFile(backupPath, raw, 'utf8');
    console.warn(`admin-jobs.json parse error. Backup: ${backupPath}`);
  } catch (backupError) {
    console.error('admin-jobs.json backup alınmadı:', backupError);
  }
};

const readJobs = async (): Promise<AdminScrapeJob[]> => {
  try {
    const raw = await fs.readFile(JOBS_FILE, 'utf8');
    try {
      return JSON.parse(raw) as AdminScrapeJob[];
    } catch {
      await createCorruptedBackup(raw);
      await fs.writeFile(JOBS_FILE, '[]', 'utf8');
      return [];
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeJobs = async (jobs: AdminScrapeJob[]) => {
  await ensureDirs();
  const tempFile = `${JOBS_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(jobs, null, 2), 'utf8');
  await fs.rename(tempFile, JOBS_FILE);
};

export const listJobs = async (limit = 25): Promise<AdminScrapeJob[]> => {
  const jobs = await readJobs();
  return jobs.slice(0, limit);
};

export const getJobById = async (jobId: string): Promise<AdminScrapeJob | undefined> => {
  const jobs = await readJobs();
  return jobs.find((job) => job.id === jobId);
};

export interface CreateJobInput {
  params: AdminScrapeRequest & { triggeredBy: string };
  status?: AdminJobStatus;
}

export const createJobRecord = async ({ params, status = 'queued' }: CreateJobInput): Promise<AdminScrapeJob> => {
  const jobs = await readJobs();
  const id = randomUUID();
  const logPath = path.join(LOG_DIR, `${id}.log`);
  const job: AdminScrapeJob = {
    id,
    status,
    createdAt: new Date().toISOString(),
    params,
    logPath,
    progress: {
      phase: 'queued',
      processed: 0,
      total: Math.max(1, params.categoryUrls?.length ?? 1),
      percent: 0,
      message: 'Növbədə'
    },
    supabaseSyncStatus: 'idle'
  };

  const nextJobs = [job, ...jobs].slice(0, 50);
  await writeJobs(nextJobs);
  return job;
};

export const updateJobRecord = async (
  jobId: string,
  patch: Partial<Omit<AdminScrapeJob, 'id' | 'params'>> & { params?: Partial<AdminScrapeJob['params']> }
): Promise<AdminScrapeJob | undefined> => {
  const jobs = await readJobs();
  const idx = jobs.findIndex((job) => job.id === jobId);
  if (idx === -1) {
    return undefined;
  }

  const job = jobs[idx];
  const nextJob: AdminScrapeJob = {
    ...job,
    ...patch,
    params: {
      ...job.params,
      ...(patch.params ?? {})
    },
    progress: patch.progress ? { ...job.progress, ...patch.progress } : job.progress
  };
  jobs[idx] = nextJob;
  await writeJobs(jobs);
  return nextJob;
};

export const appendJobLog = async (jobId: string, chunk: string) => {
  await ensureDirs();
  const logFile = path.join(LOG_DIR, `${jobId}.log`);
  await fs.appendFile(logFile, chunk, 'utf8');
};

export const getJobLog = async (jobId: string): Promise<string> => {
  try {
    return await fs.readFile(path.join(LOG_DIR, `${jobId}.log`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return '';
    }
    throw error;
  }
};
