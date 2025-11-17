create table if not exists public.scraped_listings (
  id uuid primary key default gen_random_uuid(),
  job_id text not null,
  tap_id text unique,
  title text,
  price numeric,
  currency text,
  seller_name text,
  seller_type text,
  category_slug text,
  subcategory_slug text,
  is_new boolean,
  view_count integer,
  favorites_count integer,
  posted_at timestamptz,
  fetched_at timestamptz default now(),
  listing_url text,
  image_url text,
  raw jsonb,
  inserted_at timestamptz default now()
);

create index if not exists scraped_listings_job_id_idx on public.scraped_listings (job_id);
create index if not exists scraped_listings_category_idx on public.scraped_listings (category_slug, subcategory_slug);
