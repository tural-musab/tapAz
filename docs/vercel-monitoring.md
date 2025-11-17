## Vercel Deployment Monitorinqi

Bu sənəd admin panelində göstərilən Vercel deployment statusunun necə işlədiyini və GitHub Actions vasitəsilə push sonrası yoxlamanın necə aparılacağını izah edir.

### 1. Ətraf mühit dəyişənləri
```
VERCEL_TOKEN=vercel_personal_access_token
VERCEL_PROJECT_NAME=tapAz
VERCEL_TEAM_ID=team_xxx   # (isteğe bağlı)
```
- `VERCEL_TOKEN` – Vercel hesabınızda **Settings → Tokens** bölməsindən yaratdığınız Personal Access Token. App scope kifayətdir.
- `VERCEL_PROJECT_NAME` – Vercel layihəsinin adı (dashboard-da göründüyü kimi). Default olaraq `tapAz` götürülür.
- `VERCEL_TEAM_ID` – layihə bir team altında yerləşirsə tələb olunur; fərdi hesabda boş buraxa bilərsiniz.

### 2. Admin API-ləri
- `GET /api/admin/vercel` – son 5 deployment-i Vercel API-dan oxuyur; nəticə `Activity Log` bölməsində göstərilir.
- `GET /api/admin/scrape` və `/api/admin/plan` route-ları ilə eyni token (`ADMIN_DASHBOARD_TOKEN`) istifadə olunur; yəni admin panelinə girişiniz varsa bu API-yə də çıxışınız var.

### 3. GitHub Actions integration
Push sonrası Vercel deployment statusunu izləmək üçün GitHub Actions workflow-una aşağıdakı addımı əlavə edə bilərsiniz:
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Trigger Vercel Build
        run: |
          npx vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
      - name: Record deployment status
        run: |
          curl -s -H "x-admin-token: ${{ secrets.ADMIN_DASHBOARD_TOKEN }}" https://yourdomain.com/api/admin/vercel > /dev/null
```
Workflow resultləri admin panelində `Activity Log` bölməsinə düşəcək, çünki server tərəfində son deployment-lər server render zamanı oxunur.

### 4. Lokal test
1. `.env.local` faylına `VERCEL_TOKEN`, `VERCEL_PROJECT_NAME`, `VERCEL_TEAM_ID` (lazım olduqda) əlavə edin.
2. `npm run dev` → `http://localhost:3000/admin` ünvanını açın.
3. `Activity Log` bölməsi avtomatik olaraq Vercel API-dan gələn nəticələri göstərəcək; token təyin edilməyibsə əvvəlki mock məlumatlar istifadə olunur.

### 5. Risklər
- `VERCEL_TOKEN` şəxsi hesabınıza tam giriş verdiyi üçün yalnız server-side istifadə edin, client bundle-a çıxarmayın.
- Team ID yanlışdırsa, API boş cavab qaytaracaq; admin panelində xəbərdarlıq göstərilir.
- Vercel API limitləri var (Default 1000 sorğu/saat). Admin paneli SSR zamanı 5-lik limitlə sorğu göndərdiyi üçün təhlükəsizdir.
