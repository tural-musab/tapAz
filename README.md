## Tap.az Analytics Web Uygulaması

Bu dizin, Tap.az elanlarından toplanan məlumatları vizuallaşdıran Next.js tətbiqini ehtiva edir. Layihənin ümumi vizyonu, data strategiyası və roadmap-i üçün repozitoriyanın kökündəki `README.md` sənədinə baxın.

### Çalıştırma
```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run collect    # scripts/tapazCollector.ts (cheerio)

# Playwright əsaslı scraper
# 1) Chromium quraşdırılması üçün (diskdə ~130 MB boş yer tələb edir):
#    npx playwright install chromium
# 2) Konfiqurasiyanı scrape.env.example əsasında .env faylına köçürün
npm run collect:playwright

# Snapshot nəticəsini UI datasına yazmaq:
npm run data:sync

# Supabase mühit dəyişənləri üçün nümunə fayl
cp .env.local.example .env.local && edit
```

### Qovluqlar
- `src/app` – App Router, API route-lar və səhifələr
- `src/components` – dashboard və UI komponentləri
- `src/data` – demo dataset
- `src/lib` – filtr/sort loqikası və util-lər
- `scripts/tapazCollector.ts` – Tap.az-dan məlumat toplamaq üçün legacy skript
- `scripts/tapazCollector.playwright.ts` – Cloudflare bloklarını brauzer kimi keçərək real elanları yığan skript
- `scripts/snapshotToDataset.ts` – Son snapshot faylını `src/data/listings.json` formatına çevirən skript
- `scrape.env.example` – Playwright toplayıcısı üçün nümunə mühit dəyişənləri
- `.env.local.example` – Supabase, admin token və digər server-side parametrlər üçün şablon

### Ətraflı sənədlər
Kök `README.md` sənədində:
1. Məlumat toplama planı və hüquqi qeydlər
2. Yol xəritəsi
3. Arxitektura diaqramı və risklər
4. Admin panel roadmap-i (`docs/admin-dashboard-plan.md`)
5. Supabase gecə planı və cron scaffoldu (`docs/nightly-plan.md`)

Bu dosya yalnız tətbiqin tez istismara alınması üçün minimal istiqamətləndirmə verir.

### Snapshot → Demo dataset axını
1. `npm run collect:playwright` (və ya admin panelindən job) işlədildikdə `data/snapshots/` qovluğunda `tapaz-live-*.json` faylı yaranır.
2. Lokal demo dataset-in yenilənməsi üçün hər yeni snapshotdan sonra `npm run data:sync` işlədin; skript ən son faylı oxuyub `src/data/listings.json`-u yeniləyir.
3. Supabase xidmət açarları `.env.local` daxilində mövcud olduqda admin paneli və `/api/listings` endpoint-i avtomatik `scraped_listings` cədvəlindən oxuyacaq, əks halda bu yenilənmiş JSON fallback kimi istifadə olunur.

### GitHub Actions gece planı
- `.github/workflows/nightly-scrape.yml` workflow-u Bakı vaxtı ilə 02:00-da işləyir və `ADMIN_ENDPOINT` repo var-i ilə göstərilən hostda `/api/admin/plan` → `/api/admin/scrape` ardıcıllığını çağırır.
- İşə salmaq üçün
  1. `Settings → Repository Variables` altında `ADMIN_ENDPOINT=https://your-domain.com` kimi dəyər daxil edin.
  2. `Settings → Secrets` altında `ADMIN_DASHBOARD_TOKEN` secret-i təyin edin (UI/cron üçün eyni uzun token).
  3. Zərurət olduqda `workflow_dispatch` ilə manuel trigger edib job loglarını yoxlayın.

### Planlaşdırıcı parametrləri
- Scheduler default olaraq hər gün 02:00 Bakı vaxtında işləyir, amma UI-da `Hər gün`, `Həftəlik` və `Aylıq` rejimlərini seçib saatı dəyişmək mümkündür; həftəlik rejimdə konkret günləri, aylıq rejimdə isə 1–31 arası istənilən kombinasiyanı qeyd edə bilərsiniz.
- Kateqoriya strateqiyası `Bütün kateqoriyalar` və `Xüsusi sıra` rejimlərini dəstəkləyir: hamısı rejimində istisnalarla birlikdə ardıcıl toplama aktivdir, xüsusi rejimdə isə drag-free düymələrlə sıra qurulur.
- “Kateqoriyalararası gecikmə” sahəsi Playwright job-larının kateqoriyalar arasında neçə dəqiqə gözləyəcəyini təyin edir (default 5 dəqiqə), beləliklə Tap.az-a həddindən artıq yük düşməsinin qarşısı alınır.
