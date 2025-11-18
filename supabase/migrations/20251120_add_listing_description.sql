alter table if exists public.scraped_listings
  add column if not exists description text;
