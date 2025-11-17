import categoriesData from '@/data/categories.json';
import listingsData from '@/data/listings.json';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { ManualCollectorForm } from '@/components/admin/ManualCollectorForm';
import { NightlyPlanCard } from '@/components/admin/NightlyPlanCard';
import { ActivityTimeline } from '@/components/admin/ActivityTimeline';
import { EXCLUDED_CATEGORY_IDS } from '@/lib/constants';
import { validateAdminAccess } from '@/lib/admin/auth';
import type { AdminActivityItem, AdminOverviewStats } from '@/lib/admin/types';
import { loadNightlyPlan } from '@/lib/admin/planStore';
import { fetchLatestDeployments } from '@/lib/admin/vercel';
import type { Category, Listing } from '@/lib/types';
import type { AdminSearchParams } from '@/lib/admin/auth';

const listings = listingsData as Listing[];
const categories = categoriesData as Category[];

const availableCategories = categories.filter((category) => !EXCLUDED_CATEGORY_IDS.includes(category.id));

const mockOverview: AdminOverviewStats = {
  lastSnapshotAt: new Date().toISOString(),
  snapshotFile: 'data/snapshots/2025-11-17T02-00-00.json',
  totalListings: listings.length,
  trackedCategories: availableCategories.length,
  nightlyPlanStatus: 'draft',
  supabaseSyncStatus: 'pending',
  runningJob: {
    id: 'PX-132',
    startedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    categoryCount: 2,
    pageLimit: 3
  }
};

const mockActivities: AdminActivityItem[] = [
  {
    id: 'deploy-vercel',
    title: 'Vercel build #latest',
    description: 'tapAz layihəsi üçün `main` branch push-u deploy edildi.',
    timestamp: new Date().toISOString(),
    status: 'success',
    link: 'https://vercel.com',
    linkLabel: 'Vercel'
  },
  {
    id: 'collect-playwright',
    title: 'Playwright toplayıcısı',
    description: 'Elektronika · Telefonlar kateqoriyası üçün 4 səhifə toplandı.',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: 'running'
  },
  {
    id: 'supabase-sync',
    title: 'Supabase snapshot sinkronu',
    description: 'Gecə planında seçilmiş kateqoriyalar üçün `listings` cədvəli yenilənib.',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    status: 'queued'
  }
];

interface AdminPageProps {
  searchParams: Promise<AdminSearchParams>;
}

const UnauthorizedPanel = ({ message }: { message?: string }) => (
  <section className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-6 text-rose-100">
    <h1 className="text-2xl font-semibold">Admin panel üçün token tələb olunur</h1>
    <p className="mt-3 text-sm leading-relaxed text-rose-200">
      {message ?? 'Giriş üçün `ADMIN_DASHBOARD_TOKEN` uyğun gəlməlidir. URL-yə `?token=...` əlavə edin və ya sorğuya `x-admin-token` header-i daxil edin.'}
    </p>
    <p className="mt-4 text-xs text-rose-300">
      Ətraflı: `.env.local` faylında `ADMIN_DASHBOARD_TOKEN` təyin edin və dəyəri paylaşmadan saxlayın.
    </p>
  </section>
);

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedSearchParams = await searchParams;
  const auth = await validateAdminAccess(resolvedSearchParams);

  if (!auth.allowed) {
    return (
      <div className="space-y-4">
        <UnauthorizedPanel message={auth.message} />
      </div>
    );
  }

  const planPayload = await loadNightlyPlan();
  const vercelStatus = await fetchLatestDeployments(5);
  const vercelActivities: AdminActivityItem[] = vercelStatus.deployments.map((deployment) => ({
    id: deployment.id,
    title: `Vercel deployment ${deployment.state}`,
    description: deployment.url,
    timestamp: deployment.createdAt,
    status:
      deployment.state === 'READY'
        ? 'success'
        : deployment.state === 'ERROR'
          ? 'error'
          : 'running',
    link: deployment.url,
    linkLabel: 'Vercel'
  }));
  const activityFeed = (vercelActivities.length > 0 ? vercelActivities : mockActivities).slice(0, 5);

  return (
    <div className="space-y-8">
      <div id="overview">
        <AdminOverview stats={mockOverview} />
      </div>
      <div id="manual">
        <ManualCollectorForm categories={availableCategories} authToken={auth.resolvedToken} />
      </div>
      <div id="nightly">
        <NightlyPlanCard
          categories={availableCategories}
          plan={planPayload.plan}
          source={planPayload.source}
          authToken={auth.resolvedToken}
        />
      </div>
      <div id="activity">
        <ActivityTimeline activities={activityFeed} />
      </div>
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-xs text-slate-400">
        <p>Token mənbəyi: {auth.tokenSource ?? 'məhdudlaşdırılmayıb'}</p>
        {auth.resolvedToken ? (
          <p>POST /api/admin/scrape və GET /api/admin/scrape/:jobId sorğularında `x-admin-token` header-i avtomatik əlavə olunur.</p>
        ) : (
          <p>Token təyin edilməyib, hazırda endpoint-lər açıq şəkildə işləyir.</p>
        )}
        <p>Gecə planı Supabase cədvəlləri (`scheduler_settings`, `category_plan`) mövcud olmadıqda avtomatik olaraq `data/admin-nightly-plan.json` faylına yazılır.</p>
      </div>
    </div>
  );
}
