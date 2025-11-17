import type { AdminActivityItem } from '@/lib/admin/types';

interface ActivityTimelineProps {
  activities: AdminActivityItem[];
}

const statusColors: Record<AdminActivityItem['status'], string> = {
  success: 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/60',
  error: 'bg-rose-500/20 text-rose-200 ring-rose-400/60',
  running: 'bg-amber-500/20 text-amber-200 ring-amber-400/60',
  queued: 'bg-slate-600/40 text-slate-200 ring-slate-500/60',
  idle: 'bg-slate-800 text-slate-400 ring-slate-700'
};

const statusLabel: Record<AdminActivityItem['status'], string> = {
  success: 'Uğurlu',
  error: 'Xəta',
  running: 'İcra olunur',
  queued: 'Gözləyir',
  idle: 'Dayanıb'
};

export const ActivityTimeline = ({ activities }: ActivityTimelineProps) => (
  <section className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Activity log</p>
        <h2 className="text-xl font-semibold text-white">Deploy, Playwright və Supabase hadisələri</h2>
      </div>
      <p className="text-sm text-slate-400">İzlənən {activities.length} hadisə</p>
    </div>

    <ol className="mt-6 space-y-4">
      {activities.map((item) => (
        <li key={item.id} className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-white">{item.title}</p>
              <p className="text-sm text-slate-400">{item.description}</p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusColors[item.status]}`}
            >
              <span className="size-2 rounded-full bg-current" />
              {statusLabel[item.status]}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <p>{new Intl.DateTimeFormat('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.timestamp))}</p>
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-300 underline-offset-4 hover:text-emerald-200 hover:underline"
              >
                {item.linkLabel ?? 'Detallar'}
              </a>
            )}
          </div>
        </li>
      ))}
    </ol>
  </section>
);
