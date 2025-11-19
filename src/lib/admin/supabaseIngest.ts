import fs from 'node:fs/promises';
import { chunk } from '@/lib/chunk';
import { getSupabaseAdmin, hasSupabaseAdmin } from '@/lib/admin/supabaseClient';
import type { SupabaseSyncStatus } from '@/lib/admin/types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface SnapshotItem {
  tapId?: string;
  title?: string;
  description?: string;
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

export const uploadSnapshotToSupabase = async (
  jobId: string,
  snapshotPath: string,
  options?: { client?: SupabaseClient }
): Promise<SupabaseIngestResult> => {
  const internalClient = options?.client ?? getSupabaseAdmin();

  if (!hasSupabaseAdmin() && !options?.client) {
    return { status: 'skipped', message: 'Supabase deaktivdir' };
  }

  if (!internalClient) {
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

  const { error } = await internalClient.from('scraped_listings').upsert(rows, { onConflict: 'tap_id' });
  if (error) {
    throw new Error(error.message);
  }

  return {
    status: 'success',
    count: rows.length
  };
};

type ScrapedListingRow = {
  tap_id: string;
  title: string | null;
  description: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  seller_name: string | null;
  seller_type: string | null;
  location: string | null;
  price: number | null;
  currency: string | null;
  view_count: number | null;
  favorites_count: number | null;
  posted_at: string | null;
  fetched_at: string | null;
  image_url: string | null;
  is_new: boolean | null;
  raw: Record<string, unknown> | null;
};

interface ListingExistingRow {
  id: string;
  remote_id: string;
  price_current: number | null;
  first_seen_at: string | null;
  status: string | null;
}

interface ListingInfoRow {
  id: string;
  remote_id: string;
  price_current: number | null;
}

interface ListingDailyStatsPayload {
  listing_id: string;
  snapshot_date: string;
  views_total: number;
  favorites_count: number;
  price: number | null;
  scraped_at: string;
  job_id: string;
}

interface ListingPriceChangePayload {
  listing_id: string;
  old_price: number | null;
  new_price: number | null;
  changed_at: string;
  job_id: string;
}

interface ListingUpsertPayload {
  remote_id: string;
  title: string | null;
  description: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  seller_name: string | null;
  seller_type: string | null;
  location: string | null;
  image_url: string | null;
  price_current: number | null;
  currency: string | null;
  status: string | null;
  is_new: boolean;
  first_seen_at: string | null;
  last_seen_at: string;
  last_scraped_job_id: string;
  metadata: Record<string, unknown> | null;
}

const fetchScrapedRows = async (client: SupabaseClient, jobId: string) => {
  const { data, error } = await client
    .from('scraped_listings')
    .select(
      `
      tap_id,
      title,
      description,
      category_slug,
      subcategory_slug,
      seller_name,
      seller_type,
      location,
      price,
      currency,
      view_count,
      favorites_count,
      posted_at,
      fetched_at,
      image_url,
      is_new,
      raw
    `
    )
    .eq('job_id', jobId);

  if (error) {
    throw new Error(`Scraped listings oxunmadı: ${error.message}`);
  }

  return (data ?? []) as ScrapedListingRow[];
};

const fetchExistingListings = async (client: SupabaseClient, remoteIds: string[]) => {
  const result = new Map<string, ListingExistingRow>();
  for (const batch of chunk(remoteIds, 1000)) {
    if (batch.length === 0) continue;
    const { data, error } = await client
      .from('listings')
      .select('id, remote_id, price_current, first_seen_at, status')
      .in('remote_id', batch);
    if (error) {
      throw new Error(`Mevcut listings oxunmadı: ${error.message}`);
    }
    (data as ListingExistingRow[] | null)?.forEach((row) => {
      result.set(row.remote_id, row);
    });
  }
  return result;
};

const fetchListingInfo = async (client: SupabaseClient, remoteIds: string[]) => {
  const result = new Map<string, ListingInfoRow>();
  for (const batch of chunk(remoteIds, 1000)) {
    if (batch.length === 0) continue;
    const { data, error } = await client
      .from('listings')
      .select('id, remote_id, price_current')
      .in('remote_id', batch);
    if (error) {
      throw new Error(`Listings informacion oxunmadı: ${error.message}`);
    }
    (data as ListingInfoRow[] | null)?.forEach((row) => {
      result.set(row.remote_id, row);
    });
  }
  return result;
};

const upsertListings = async (
  client: SupabaseClient,
  rows: ScrapedListingRow[],
  existingMap: Map<string, ListingExistingRow>,
  snapshotISO: string,
  jobId: string
) => {
  const payloads: ListingUpsertPayload[] = rows.reduce((acc: ListingUpsertPayload[], row) => {
    const remoteId = row.tap_id;
    if (!remoteId) return acc;
    const existing = existingMap.get(remoteId);
    acc.push({
      remote_id: remoteId,
      title: row.title ?? existing?.remote_id ?? remoteId,
      description: row.description ?? null,
      category_slug: row.category_slug ?? null,
      subcategory_slug: row.subcategory_slug ?? null,
      seller_name: row.seller_name ?? null,
      seller_type: row.seller_type ?? null,
      location: row.location ?? null,
      image_url: row.image_url ?? null,
      price_current: row.price ?? existing?.price_current ?? null,
      currency: row.currency ?? 'AZN',
      status: existing?.status ?? 'active',
      is_new: existing ? false : row.is_new ?? true,
      first_seen_at: existing?.first_seen_at ?? snapshotISO,
      last_seen_at: snapshotISO,
      last_scraped_job_id: jobId,
      metadata: row.raw ?? null
    });
    return acc;
  }, []);

  for (const batch of chunk(payloads, 500)) {
    if (batch.length === 0) continue;
    const { error } = await client.from('listings').upsert(batch, { onConflict: 'remote_id' });
    if (error) {
      throw new Error(`Listings upsert alınmadı: ${error.message}`);
    }
  }

  return payloads.length;
};

const upsertDailyStats = async (
  client: SupabaseClient,
  rows: ScrapedListingRow[],
  listingMap: Map<string, ListingInfoRow>,
  snapshotDate: string,
  snapshotISO: string,
  jobId: string
) => {
  const payloads: ListingDailyStatsPayload[] = rows.reduce((acc: ListingDailyStatsPayload[], row) => {
    const listing = listingMap.get(row.tap_id);
    if (!listing) {
      return acc;
    }
    acc.push({
      listing_id: listing.id,
      snapshot_date: snapshotDate,
      views_total: row.view_count ?? 0,
      favorites_count: row.favorites_count ?? 0,
      price: row.price ?? listing.price_current ?? null,
      scraped_at: row.fetched_at ?? snapshotISO,
      job_id: jobId
    });
    return acc;
  }, []);

  for (const batch of chunk(payloads, 500)) {
    if (batch.length === 0) continue;
    const { error } = await client
      .from('listing_daily_stats')
      .upsert(batch, { onConflict: 'listing_id,snapshot_date' });
    if (error) {
      throw new Error(`Günlük stats upsert alınmadı: ${error.message}`);
    }
  }

  return payloads.length;
};

const insertPriceChanges = async (
  client: SupabaseClient,
  rows: ScrapedListingRow[],
  existingMap: Map<string, ListingExistingRow>,
  listingMap: Map<string, ListingInfoRow>,
  snapshotISO: string,
  jobId: string
) => {
  const payloads: ListingPriceChangePayload[] = rows.reduce((acc: ListingPriceChangePayload[], row) => {
    const remoteId = row.tap_id;
    if (!remoteId) return acc;
    const existing = existingMap.get(remoteId);
    const listing = listingMap.get(remoteId);
    if (!existing || !listing) {
      return acc;
    }
    const oldPrice = existing.price_current ?? null;
    const newPrice = row.price ?? listing.price_current ?? null;
    if ((oldPrice ?? null) === (newPrice ?? null)) {
      return acc;
    }
    acc.push({
      listing_id: listing.id,
      old_price: oldPrice,
      new_price: newPrice,
      changed_at: snapshotISO,
      job_id: jobId
    });
    return acc;
  }, []);

  for (const batch of chunk(payloads, 500)) {
    if (batch.length === 0) continue;
    const { error } = await client.from('listing_price_changes').insert(batch);
    if (error) {
      throw new Error(`Price change insert alınmadı: ${error.message}`);
    }
  }

  return payloads.length;
};

export const processCanonicalForJob = async (supabase: SupabaseClient, jobId: string, snapshotDate: Date): Promise<void> => {
  const rows = await fetchScrapedRows(supabase, jobId);
  if (rows.length === 0) {
    console.log(`[canonical] Job ${jobId}: scraped data tapılmadı.`);
    return;
  }

  const remoteIds = rows.map((row) => row.tap_id).filter((id): id is string => Boolean(id));
  if (remoteIds.length === 0) {
    console.log(`[canonical] Job ${jobId}: remote_id tapılmadı.`);
    return;
  }

  const snapshotISO = snapshotDate.toISOString();
  const snapshotDay = snapshotISO.split('T')[0];
  const existingMap = await fetchExistingListings(supabase, remoteIds);

  const listingsUpserted = await upsertListings(supabase, rows, existingMap, snapshotISO, jobId);

  const listingInfoMap = await fetchListingInfo(supabase, remoteIds);
  const statsUpserted = await upsertDailyStats(supabase, rows, listingInfoMap, snapshotDay, snapshotISO, jobId);
  const priceChanges = await insertPriceChanges(supabase, rows, existingMap, listingInfoMap, snapshotISO, jobId);

  console.log(
    `[canonical] Job ${jobId}: listings=${listingsUpserted}, stats=${statsUpserted}, price_changes=${priceChanges}`
  );
};
