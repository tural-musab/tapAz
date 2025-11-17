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

### Ətraflı sənədlər
Kök `README.md` sənədində:
1. Məlumat toplama planı və hüquqi qeydlər
2. Yol xəritəsi
3. Arxitektura diaqramı və risklər
4. Admin panel roadmap-i (`docs/admin-dashboard-plan.md`)
5. Supabase gecə planı və cron scaffoldu (`docs/nightly-plan.md`)

Bu dosya yalnız tətbiqin tez istismara alınması üçün minimal istiqamətləndirmə verir.
