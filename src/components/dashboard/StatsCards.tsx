import { AggregateStats } from '@/lib/types';
import { formatDate, formatNumber, formatPrice } from '@/lib/formatters';
import { Flame, Eye, Coins, Clock, Store } from 'lucide-react';

interface StatsCardsProps {
  stats: AggregateStats;
  isLoading: boolean;
}

const baseCardClass =
  'rounded-3xl border border-white/5 bg-gradient-to-br from-white/10 to-white/5 p-5 text-white shadow-lg shadow-black/30';

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={`${baseCardClass} animate-pulse bg-white/5`}>
            <div className="h-4 w-24 rounded-full bg-white/20" />
            <div className="mt-4 h-8 w-32 rounded-full bg-white/30" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Ortalama baxış',
      value: stats.avgViews ? formatNumber(stats.avgViews) : '—',
      icon: Eye,
      accent: 'from-sky-500/30 to-sky-600/10'
    },
    {
      label: 'Ortalama qiymət',
      value: stats.avgPrice ? formatPrice(stats.avgPrice) : '—',
      icon: Coins,
      accent: 'from-emerald-500/30 to-emerald-600/10'
    },
    {
      label: 'Ən populyar elan',
      value: stats.hottestListing ? stats.hottestListing.title : '—',
      subtitle: stats.hottestListing ? `${formatNumber(stats.hottestListing.viewCount)} baxış` : undefined,
      icon: Flame,
      accent: 'from-amber-500/30 to-amber-600/10'
    },
    {
      label: 'Ən yeni elan',
      value: stats.freshestListing ? stats.freshestListing.title : '—',
      subtitle: stats.freshestListing ? formatDate(stats.freshestListing.postedAt) : undefined,
      icon: Clock,
      accent: 'from-purple-500/30 to-purple-600/10'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, subtitle, icon: Icon, accent }) => (
        <div key={label} className={`${baseCardClass} bg-gradient-to-br ${accent}`}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-2">
              <Icon className="size-5 text-white" />
            </div>
            <span className="text-xs uppercase tracking-wide text-white/70">{label}</span>
          </div>
          <p className="mt-4 text-lg font-semibold leading-tight">{value}</p>
          {subtitle && <p className="text-sm text-white/70">{subtitle}</p>}
        </div>
      ))}
      <div className={`${baseCardClass} md:col-span-2 xl:col-span-4`}>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/15 p-2">
            <Store className="size-5 text-white" />
          </div>
          <span className="text-xs uppercase tracking-wide text-white/70">Ən çox baxılan mağazalar</span>
        </div>
        {stats.topStores.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {stats.topStores.map((store) => (
              <li
                key={store.sellerName}
                className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-2 text-white/90"
              >
                <span className="font-medium">{store.sellerName}</span>
                <span className="text-xs text-white/60">
                  {formatNumber(store.totalViews)} baxış • {store.listingCount} elan
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/70">Məlumat mövcud deyil.</p>
        )}
      </div>
    </div>
  );
}

