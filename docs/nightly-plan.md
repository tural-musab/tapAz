## Nightly Scheduler və Supabase Planı

Bu sənəd gecə toplayıcısı üçün Supabase əsaslı plan saxlanmasını və GitHub Actions cron scaffolding-i izah edir.

### 1. Supabase cədvəlləri
```sql
create table if not exists scheduler_settings (
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

create table if not exists category_plan (
  category_id text primary key,
  include boolean not null default true,
  updated_at timestamptz default now(),
  sort_order integer
);
```
- `scheduler_settings` cədvəli `schedule_type`, `run_hour:run_minute`, həftəlik və aylıq seçimlər, kateqoriya strategiyası və interval kimi əlavə sütunlarla genişlənib.
- `category_plan` siyahısında `include = true` olan kateqoriyalar aktiv, `include = false` olanlar istisna hesab olunur, `sort_order` isə xüsusi sıralamanı saxlayır.

### 2. Ətraf mühit dəyişənləri
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_DASHBOARD_TOKEN=...
VERCEL_TOKEN=...
```
- `SUPABASE_*` dəyərləri olduqda `GET/POST /api/admin/plan` Supabase ilə danışır; əks halda `data/admin-nightly-plan.json` faylına yazılır.
- `ADMIN_DASHBOARD_TOKEN` UI/API girişini qoruyur.
- `VERCEL_TOKEN` plan5 mərhələsində deployment monitorinqi üçün istifadə olunacaq.

### 3. Admin API-ləri
- `GET /api/admin/plan` → `{ plan, source, categoryQueue }` obyektini qaytarır; `categoryQueue` GitHub Actions workflow-u üçün hazır `tap.az/elanlar/<slug>` URL-lərini ehtiva edir.
- `POST /api/admin/plan` → body `scheduleType`, `runHour`, `runMinute`, `timezone`, `daysOfWeek/daysOfMonth`, `categoryStrategy`, `includeCategoryIds`, `excludeCategoryIds`, `intervalMinutes` sahələrindən ibarət olmalıdır.
- `GET /api/admin/scrape` → son 25 job.
- `POST /api/admin/scrape` → Playwright job trigger.

> Bütün sorğular `x-admin-token: <ADMIN_DASHBOARD_TOKEN>` header-i tələb edir (token təyin edilmədiyi halda açıqdır).

### 4. GitHub Actions cron nümunəsi
```yaml
name: Nightly Tap.az Scraper
on:
  schedule:
    - cron: '0 22 * * *' # UTC 22:00 = Bakı 02:00
  workflow_dispatch:

jobs:
  nightly-scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Fetch plan
        id: plan
        run: |
          RESPONSE=$(curl -s -H "x-admin-token: ${{ secrets.ADMIN_DASHBOARD_TOKEN }}" https://yourdomain.com/api/admin/plan)
          CATEGORY_URLS=$(echo $RESPONSE | jq -r '.categoryQueue | map(.url) | @json')
          if [ -z "$CATEGORY_URLS" ] || [ "$CATEGORY_URLS" = "[]" ]; then
            echo "No categories to scrape"; exit 0; fi
          echo "PLAN=$RESPONSE" >> $GITHUB_ENV
          echo "CATEGORY_URLS=$CATEGORY_URLS" >> $GITHUB_OUTPUT
      - name: Trigger scrape job
        if: steps.plan.outputs.CATEGORY_URLS != ''
        run: |
          curl -X POST \
            -H "x-admin-token: ${{ secrets.ADMIN_DASHBOARD_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "{ \"categoryUrls\": $(echo $PLAN | jq '.categoryQueue | map(.url)'), \"selections\": [], \"pageLimit\": 2, \"listingLimit\": 120, \"delayMs\": 1500, \"detailDelayMs\": 2200, \"headless\": true }" \
            https://yourdomain.com/api/admin/scrape
```
Bu workflow Supabase planını oxuyur və admin API vasitəsilə Playwright job-u sıraya qoyur. Daha sonrakı mərhələdə `VERCEL_TOKEN` istifadə edərək deployment monitorinq addımları əlavə ediləcək (plan5).
