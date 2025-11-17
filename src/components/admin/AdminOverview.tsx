import type { AdminOverviewStats } from '@/lib/admin/types';
import { formatNumber } from '@/lib/formatters';

const dtf = new Intl.DateTimeFormat('az-AZ', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

const formatDateTime = (value?: string) => {
  if (!value) {
    return 'Qeyd yoxdur';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Qeyd yoxdur';
  }

  return dtf.format(date);
};

const statusPills: Record<AdminOverviewStats['nightlyPlanStatus'], { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  ready: { label: 'Plan aktivdir', tone: 'success' },
  draft: { label: 'Plan eskiz mərhələsindədir', tone: 'warning' },
  disabled: { label: 'Plan söndürülüb', tone: 'muted' }
};

const supabaseStatusCopy: Record<AdminOverviewStats['supabaseSyncStatus'], { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  ok: { label: 'Supabase sinkron', tone: 'success' },
  pending: { label: 'Sinkron gözləyir', tone: 'warning' },
  error: { label: 'Supabase xətası', tone: 'muted' }
};

interface AdminOverviewProps {
  stats: AdminOverviewStats;
}

const statusToneClasses: Record<'success' | 'warning' | 'muted', string> = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40',
  warning: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
  muted: 'bg-slate-700/60 text-slate-300 ring-1 ring-slate-600'
};

export const AdminOverview = ({ stats }: AdminOverviewProps) => {
  const cards = [
    {
      title: 'Son snapshot',
      value: stats.lastSnapshotAt ? formatDateTime(stats.lastSnapshotAt) : 'Snapshot tapılmadı',
      helper: stats.snapshotFile ? stats.snapshotFile : 'snapshot hələ yaradılmayıb'
    },
    {
      title: 'Datasetdəki elanlar',
      value: formatNumber(stats.totalListings),
      helper: 'UI `src/data/listings.json` faylından qidalanır'
    },
    {
      title: 'İzlənən kateqoriyalar',
      value: stats.trackedCategories,
      helper: '“İş elanları” avtomatik istisna edilir'
    },
    {
      title: 'Supabase sinkron statusu',
      value: supabaseStatusCopy[stats.supabaseSyncStatus].label,
      helper: 'Gələcək mərhələdə cron + DB inteqrasiyası'
    }
  ];

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 shadow-2xl shadow-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Müşahidə Paneli</p>
          <h1 className="text-2xl font-semibold text-white">Toplayıcı və datasest xülasəsi</h1>
        </div>
        <div className="flex flex-col items-end gap-2 text-right text-sm text-slate-400">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusToneClasses[statusPills[stats.nightlyPlanStatus].tone]}`}
          >
            <span className="size-2 rounded-full bg-current" />
            {statusPills[stats.nightlyPlanStatus].label}
          </div>
          {stats.runningJob ? (
            <p className="text-slate-300">
              Aktiv job #{stats.runningJob.id} • {stats.runningJob.categoryCount} kateqoriya • {stats.runningJob.pageLimit} səhifə limiti
            </p>
          ) : (
            <p>Hazırda heç bir job işləmir</p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.title} className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-500">{card.title}</p>
            <p className="mt-3 text-2xl font-semibold text-white">{card.value}</p>
            <p className="mt-2 text-sm text-slate-400">{card.helper}</p>
          </article>
        ))}
      </div>
    </section>
  );
};
