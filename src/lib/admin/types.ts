import type { Category } from '@/lib/types';

export type AdminJobStatus = 'idle' | 'queued' | 'running' | 'success' | 'error';

export interface AdminOverviewStats {
  lastSnapshotAt?: string;
  snapshotFile?: string;
  totalListings: number;
  trackedCategories: number;
  nightlyPlanStatus: 'ready' | 'draft' | 'disabled';
  supabaseSyncStatus: 'ok' | 'error' | 'pending';
  runningJob?: {
    id: string;
    startedAt: string;
    categoryCount: number;
    pageLimit: number;
  };
}

export interface AdminActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  status: AdminJobStatus;
  link?: string;
  linkLabel?: string;
}

export interface AdminNightlyPlanState {
  cronExpression: string;
  timezone: string;
  includeCategoryIds: string[];
  excludeCategoryIds: string[];
  lastUpdatedAt: string;
  updatedBy?: string;
}

export interface ManualCollectorPreset {
  categories: Category[];
  defaultPageLimit: number;
  defaultListingLimit: number;
  defaultDelayMs: number;
  defaultDetailDelayMs: number;
}

export interface AdminScrapeSelection {
  categoryId: string;
  subcategoryId?: string;
  label?: string;
}

export interface AdminScrapeRequest {
  categoryUrls: string[];
  selections: AdminScrapeSelection[];
  pageLimit: number;
  listingLimit: number;
  delayMs: number;
  detailDelayMs: number;
  headless: boolean;
  userAgent?: string;
}

export interface AdminScrapeJob {
  id: string;
  status: AdminJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  params: AdminScrapeRequest & {
    triggeredBy: string;
  };
  logPath: string;
  outputPath?: string;
  errorMessage?: string;
}
