import fs from 'node:fs/promises';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/admin/supabaseClient';
import type { SupabaseSyncStatus } from '@/lib/admin/types';

interface SnapshotItem {
  tapId?: string;
  title?: string;
  price?: number;
  currency?: string;
  sellerName?: string;
  sellerType?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  location?: string;
  isNew?: boolean;
  viewCount?: number;
  favoritesCount?: number;
  postedAtISO?: string;
  postedAtText?: string;
  fetchedAt?: string;
  url?: string;
  imageUrl?: string;
  conditionLabel?: string;
  raw?: Record<string, unknown>;
}

interface SnapshotPayload {
  scrapedAt?: string;
  categoryUrls?: string[];
  items?: SnapshotItem[];
}

export interface SupabaseIngestResult {
  status: SupabaseSyncStatus | 'skipped';
  message?: string;
  count?: number;
}

export const uploadSnapshotToSupabase = async (jobId: string, snapshotPath: string): Promise<SupabaseIngestResult> => {
  if (!hasSupabaseAdmin()) {
    return { status: 'skipped', message: 'Supabase deaktivdir' };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { status: 'skipped', message: 'Supabase client yaradıla bilmədi' };
  }

  const raw = await fs.readFile(snapshotPath, 'utf8');
  const payload = JSON.parse(raw) as SnapshotPayload;
  const items = payload.items ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    return { status: 'skipped', message: 'Snapshot boşdur' };
  }

  const rows = items.map((item) => ({
    job_id: jobId,
    tap_id: item.tapId,
    title: item.title,
    description: item.description ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    seller_name: item.sellerName ?? null,
    seller_type: item.sellerType ?? null,
    category_slug: item.categorySlug ?? null,
    subcategory_slug: item.subcategorySlug ?? null,
    location: item.location ?? null,
    is_new: item.isNew ?? null,
    view_count: item.viewCount ?? null,
    favorites_count: item.favoritesCount ?? null,
    posted_at: item.postedAtISO ?? null,
    posted_at_iso: item.postedAtISO ?? null,
    posted_at_text: item.postedAtText ?? null,
    condition_label: item.conditionLabel ?? null,
    fetched_at: item.fetchedAt ?? payload.scrapedAt ?? new Date().toISOString(),
    listing_url: item.url ?? null,
    image_url: item.imageUrl ?? null,
    raw: item.raw ?? null
  }));

  const { error } = await supabase.from('scraped_listings').upsert(rows, { onConflict: 'tap_id' });
  if (error) {
    throw new Error(error.message);
  }

  return {
    status: 'success',
    count: rows.length
  };
};
