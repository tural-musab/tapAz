alter table if exists public.scraped_listings
  add column if not exists location text;

alter table if exists public.scraped_listings
  add column if not exists posted_at_text text;

alter table if exists public.scraped_listings
  add column if not exists posted_at_iso timestamptz;

alter table if exists public.scraped_listings
  add column if not exists condition_label text;
