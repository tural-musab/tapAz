-- Ensure scraped_listings.tap_id is always populated
update public.scraped_listings
set tap_id = concat('missing-', id)
where tap_id is null;

alter table public.scraped_listings
alter column tap_id set not null;

-- Canonical listings table
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  remote_id text not null unique,
  title text,
  description text,
  category_slug text,
  subcategory_slug text,
  seller_name text,
  seller_type text,
  location text,
  price_current numeric,
  currency text default 'AZN',
  status text default 'active',
  is_new boolean,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  last_scraped_job_id text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists listings_category_idx on public.listings (category_slug);
create index if not exists listings_last_seen_idx on public.listings (last_seen_at);

-- Daily stats table
create table if not exists public.listing_daily_stats (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  snapshot_date date not null,
  views_total integer,
  favorites_count integer,
  price numeric,
  scraped_at timestamptz default now(),
  job_id text
);

create unique index if not exists listing_daily_stats_unique_idx
  on public.listing_daily_stats (listing_id, snapshot_date);
create index if not exists listing_daily_stats_listing_idx
  on public.listing_daily_stats (listing_id);
create index if not exists listing_daily_stats_snapshot_date_idx
  on public.listing_daily_stats (snapshot_date);

-- Price change log
create table if not exists public.listing_price_changes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  changed_at timestamptz not null default now(),
  old_price numeric,
  new_price numeric,
  job_id text
);

create index if not exists listing_price_changes_listing_idx
  on public.listing_price_changes (listing_id, changed_at);

-- Scrape plans
create table if not exists public.scrape_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  schedule_type text not null check (schedule_type in ('daily','weekly','monthly','once')),
  timezone text not null default 'Asia/Baku',
  run_hour smallint not null default 2,
  run_minute smallint not null default 0,
  days_of_week smallint[] not null default '{}',
  days_of_month smallint[] not null default '{}',
  once_run_at timestamptz,
  delay_between_categories_seconds integer not null default 300,
  max_pages smallint not null default 2,
  max_listings integer not null default 120,
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists scrape_plans_next_run_idx
  on public.scrape_plans (next_run_at)
  where enabled = true;

-- Plan categories
create table if not exists public.scrape_plan_categories (
  plan_id uuid not null references public.scrape_plans(id) on delete cascade,
  category_slug text not null,
  include_subcategories boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (plan_id, category_slug)
);

create index if not exists scrape_plan_categories_order_idx
  on public.scrape_plan_categories (plan_id, order_index);

-- Scrape run logs
create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.scrape_plans(id) on delete set null,
  job_id text,
  snapshot_path text,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text not null default 'queued' check (status in ('queued','running','success','error','skipped')),
  error_message text,
  listings_count integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists scrape_runs_plan_idx
  on public.scrape_runs (plan_id, started_at);
