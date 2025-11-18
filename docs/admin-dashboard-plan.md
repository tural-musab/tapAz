## Admin Panel Planı

Bu sənəd Tap.az analitika layihəsi üçün hazırlanacaq admin panelinin mərhələli inkişaf planını sənədləşdirir. Məqsəd terminal əmrlərindən asılılığı aradan qaldırmaq, kateqoriya seçimi, gecə toplama planları və Supabase inteqrasiyasını vahid UI üzərindən idarə etməkdir.

### 1. İstifadəçi Ssenariləri
1. **Manual toplama:** Admin kateqoriya/subkateqoriya seçir, limitləri (səhifə, elan, gecikmə) daxil edir, “İndi topla” düyməsi ilə Playwright skriptini işə salır, nəticəni status panelində izləyir.
2. **Planlaşdırılmış toplama:** Admin scheduler blokunda tezliyi (gündəlik/həftəlik/aylıq), saatı, timezone-u və kateqoriya strategiyasını seçir; həm bütün kateqoriyaları ardıcıl şəkildə interval ilə toplamaq, həm də xüsusi sıra qurmaq mümkündür. Bu seçim Supabase-də saxlanılır və cron job həmin plana əsasən işləyir.
3. **Planı yeniləmə:** “İş elanları” və ya digər kateqoriyaları istisna etmək üçün toggle-lar. İstisna siyahısı serverdə saxlanılır və həm UI, həm də backend toplayıcısı tərəfindən nəzərə alınır.
4. **Monitorinq:** Son snapshot, işləyən job, Supabase yazma statusu, GitHub/Vercel deploy nəticələri UI-da görünür.

### 2. UI Strukturu
- `app/admin/layout.tsx` – qorunan layout (sadə token və ya basic-auth), sol menyu + kontent.
- Bölmələr:
  1. **Overview**: son toplama vaxtı, son snapshot, Supabase yazma statusu.
  2. **Manual Collector**: form (kateqoriya ağacı, limit input-ları, checkbox-lar, “İndi topla” düyməsi).
  3. **Planlaşdırıcı**: tezlik + zaman seçicisi, kateqoriya rejimi (hamısı/xüsusi), ardıcıllıq və interval parametrləri.
  4. **Activity Log**: GitHub push/Vercel deploy linkləri, Playwright job logları.

### 3. Data və API Layihəsi
- **API Route-lar**:
  - `POST /api/admin/scrape`: UI form məlumatını qəbul edib child process (Playwright) işə salır. Cavabda jobId qaytarır.
  - `GET /api/admin/scrape/:jobId`: job statusu (pending/running/done/error) + log path.
  - `GET /api/admin/plan`: Supabase və ya fayldakı planı + `categoryQueue` (hazır URL siyahısı) qaytarır.
  - `POST /api/admin/plan`: yeni scheduler modelini (`scheduleType`, `runHour`, `daysOfWeek/daysOfMonth`, `categoryStrategy`, `intervalMinutes`) qəbul edir və saxlayır.
  - `GET /api/admin/meta`: son snapshot, Supabase sync vaxtı, mövcud env parametrləri.
- **State Saxlama**:
  - `supabase.category_plan` (id, category_slug, include, priority, nightly_limit).
  - `supabase.scrape_jobs` (id, type, payload jsonb, status, started_at, finished_at, log_url).
  - `supabase.listings` və `listing_stats` mövcud pipeline üçün istifadə olunur.

### 4. Supabase / GitHub / Vercel Axını
1. Admin paneldə plan yenilənir → Supabase API vasitəsilə saxlanılır.
2. GitHub Actions nightly workflow-u `CRON_SCHEDULE_UTC` əsasında işə düşüb Supabase-dən planı oxuyur, Playwright skriptini işə salır, nəticəni Supabase + snapshot Storage-a yazır.
3. Hər push-dan sonra Vercel build-i avtomatik izləmək üçün GitHub Actions post-job mərhələsində `vercel deployments` API-si çağırılacaq (token tələb edir) və nəticə `scrape_jobs` və ya GitHub job logunda göstəriləcək.

### 5. İnkişaf Mərhələləri
1. **Skelet** – `/admin` route, layout, mock data ilə UI komponentləri (Charts/Status placeholders).
2. **Manual Collector API** – `POST /api/admin/scrape` child process trigger + log saxlanması.
3. **Supabase Plan API** – kateqoriya planının CRUD əməliyyatları.
4. **Cron/Actions** – GitHub workflow + Supabase service role ilə inteqrasiya.
5. **Vercel Monitorinq** – push sonrası deployment statusunu çəkən helper (token təmin edildikdən sonra).

### 6. Asılılıqlar və Təhlükəsizlik
- Admin panel yalnız autentifikasiya olunan istifadəçiyə açıq olmalıdır (başlanğıcda `.env`-də `ADMIN_DASHBOARD_TOKEN` və ya Supabase Auth).
- Playwright job-ları serverdə paralel işlədikdə resurs limitlərinə diqqət.
- Supabase service role key yalnız server-side istifadə olunacaq, UI-a heç vaxt sızmamalıdır.

Bu plan əsasında növbəti addım admin route skeletini və əsas komponentləri implementasiya etməkdir.

### 7. İcra Statusu
- [x] `/admin` route + layout + mock komponentlər – 2025-11-17
- [x] `POST /api/admin/scrape` + status API (plan3)
- [x] Supabase plan CRUD + cron scaffolding (plan4) – 2025-11-17
- [x] GitHub Actions → Vercel monitorinq addımları (plan5) – 2025-11-17

### 8. Supabase və Cron Scaffoldu
- `scheduler_settings` cədvəli: `id text primary key`, `cron_expression text`, `timezone text`, `schedule_type`, `run_hour`, `run_minute`, `days_of_week`, `days_of_month`, `category_strategy`, `interval_minutes`, `updated_at`, `updated_by`.
- `category_plan` cədvəli: `category_id text primary key`, `include boolean default true`, `sort_order integer`, `updated_at timestamptz`.
- Admin paneli `GET/POST /api/admin/plan` route-ları vasitəsilə bu cədvəlləri oxuyur/yazır; Supabase mövcud olmadıqda məlumat `data/admin-nightly-plan.json` faylına saxlanılır.
- Cron scaffoldu üçün nümunə workflow (GitHub Actions):
  ```yaml
  on:
    schedule:
      - cron: '0 22 * * *' # UTC 02:00 Bakı vaxtına uyğundur
  jobs:
    nightly-scrape:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: npm ci
        - name: Fetch nightly plan
          id: plan
          run: |
            PLAN=$(curl -s -H "x-admin-token: ${{ secrets.ADMIN_DASHBOARD_TOKEN }}" https://<domain>/api/admin/plan)
            CATEGORY_URLS=$(echo "$PLAN" | jq -r '.categoryQueue | map(.url) | @json')
            if [ -z "$CATEGORY_URLS" ] || [ "$CATEGORY_URLS" = "[]" ]; then
              echo "No categories to scrape"; exit 0; fi
            echo "PLAN=$PLAN" >> $GITHUB_ENV
            echo "CATEGORY_URLS=$CATEGORY_URLS" >> $GITHUB_OUTPUT
        - name: Trigger scrape job
          if: steps.plan.outputs.CATEGORY_URLS != ''
          run: |
            CATEGORY_URLS='${{ steps.plan.outputs.CATEGORY_URLS }}'
            curl -X POST \
              -H "x-admin-token: ${{ secrets.ADMIN_DASHBOARD_TOKEN }}" \
              -H "Content-Type: application/json" \
              -d "{ \"categoryUrls\": ${CATEGORY_URLS}, \"pageLimit\": 2, \"listingLimit\": 120, \"delayMs\": 1500, \"detailDelayMs\": 2200, \"headless\": true }" \
              https://<domain>/api/admin/scrape
  ```
- `VERCEL_TOKEN` gələcək mərhələdə build monitorinqi üçün istifadə olunacaq; hazırda `.env.local` daxilində saxlanılır.

### 9. Auth & Sessiya Layihəsi
- Login səhifəsi iki demo istifadəçi ilə təmin edilib: `tapaz_admin / Admin!2024` (admin) və `tapaz_user / User!2024` (normal). Dəyərləri `AUTH_*` env dəyişənləri ilə yeniləyə bilərsiniz.
- `middleware.ts` bütün route-ları qoruyur; yalnız `/login` və auth API-ləri istisnadır. Admin route-u əlavə olaraq rolu yoxlayır.
- Sessiya cookie-ləri: `tapaz-role`, `tapaz-username`, admin istifadəçilər üçün `tapaz-admin-token` (`ADMIN_DASHBOARD_TOKEN` dəyəri ilə).
- Header komponenti cari istifadəçini göstərir və `Logout` düyməsi `POST /api/auth/logout` endpoint-i ilə cookie-ləri silir.
