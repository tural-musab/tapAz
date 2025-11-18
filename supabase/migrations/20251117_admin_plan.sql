create table if not exists public.scheduler_settings (
  id text primary key,
  cron_expression text not null,
  timezone text not null,
  updated_at timestamptz default now(),
  updated_by text,
  schedule_type text not null default 'daily',
  run_hour smallint not null default 2,
  run_minute smallint not null default 0,
  days_of_week text[] default '{}'::text[],
  days_of_month smallint[] default '{}'::smallint[],
  category_strategy text not null default 'all',
  interval_minutes integer not null default 5
);

create table if not exists public.category_plan (
  category_id text primary key,
  include boolean not null default true,
  updated_at timestamptz default now(),
  sort_order integer
);
