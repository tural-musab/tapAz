## Nightly Scheduler və Supabase Planı

Bu sənəd gecə toplayıcısı üçün Supabase əsaslı plan saxlanmasını və GitHub Actions cron scaffolding-i izah edir.

### 1. Supabase cədvəlləri
```sql
create table if not exists scheduler_settings (
  id text primary key,
  cron_expression text not null,
  timezone text not null,
  updated_at timestamptz default now(),
  updated_by text
);

create table if not exists category_plan (
  category_id text primary key,
  include boolean not null default true,
  updated_at timestamptz default now()
);
```
- `scheduler_settings` cədvəli hazirda yalnız `id = 'nightly'` sətrini istifadə edir.
- `category_plan` siyahısında `include = true` olan kateqoriyalar aktiv, `include = false` olanlar istisna hesab olunur.

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
- `GET /api/admin/plan` → `{ plan, source }` obyektini qaytarır (`source = supabase|file`).
- `POST /api/admin/plan` → body `cronExpression`, `timezone`, `includeCategoryIds`, `excludeCategoryIds` sahələrindən ibarət olmalıdır.
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
          echo "PLAN=$RESPONSE" >> $GITHUB_ENV
      - name: Trigger scrape job
        run: |
          curl -X POST \
            -H "x-admin-token: ${{ secrets.ADMIN_DASHBOARD_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "$(echo $PLAN | jq '{categoryUrls: .plan.includeCategoryIds, selections: [], pageLimit: 2, listingLimit: 120, delayMs: 1500, detailDelayMs: 2200, headless: true}')" \
            https://yourdomain.com/api/admin/scrape
```
Bu workflow Supabase planını oxuyur və admin API vasitəsilə Playwright job-u sıraya qoyur. Daha sonrakı mərhələdə `VERCEL_TOKEN` istifadə edərək deployment monitorinq addımları əlavə ediləcək (plan5).
