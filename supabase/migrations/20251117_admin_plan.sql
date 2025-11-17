create table if not exists public.scheduler_settings (
  id text primary key,
  cron_expression text not null,
  timezone text not null,
  updated_at timestamptz default now(),
  updated_by text
);

create table if not exists public.category_plan (
  category_id text primary key,
  include boolean not null default true,
  updated_at timestamptz default now()
);
