import clsx from 'clsx';
import { AlertTriangle, ExternalLink, Loader } from 'lucide-react';
import { Listing } from '@/lib/types';
import { formatDate, formatNumber, formatPrice } from '@/lib/formatters';
import Badge from '../ui/Badge';

interface ListingsTableProps {
  items?: Listing[];
  isLoading: boolean;
  errorMessage: string | null;
  categoryLabels?: Record<string, string>;
  subcategoryLabels?: Record<string, string>;
}

const headerClassName = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white/60';
const cellClassName = 'px-4 py-4 align-top text-sm text-white/90';

export default function ListingsTable({
  items = [],
  isLoading,
  errorMessage,
  categoryLabels = {},
  subcategoryLabels = {}
}: ListingsTableProps) {
  if (errorMessage) {
    return (
      <div className="flex items-center gap-3 px-6 py-20 text-amber-200">
        <AlertTriangle className="size-5" />
        <p>{errorMessage}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 px-6 py-20 text-white/70">
        <Loader className="size-5 animate-spin" />
        <p>Yüklənir...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="px-6 py-20 text-center text-white/70">
        <p>Seçilən filtr parametrlərinə uyğun elan tapılmadı.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-white/5">
        <thead>
          <tr>
            <th className={headerClassName}>Məhsul</th>
            <th className={headerClassName}>Təsvir</th>
            <th className={headerClassName}>Kateqoriya</th>
            <th className={headerClassName}>Status</th>
            <th className={headerClassName}>Qiymət</th>
            <th className={headerClassName}>Satıcı</th>
            <th className={headerClassName}>Statistika</th>
            <th className={headerClassName}>İdarəetmə</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-white/5">
              <td className={clsx(cellClassName, 'min-w-[220px]')}>
                <div className="space-y-2">
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-xs uppercase tracking-wide text-white/60">Elan №{item.tapId}</p>
                </div>
              </td>
              <td className={clsx(cellClassName, 'min-w-[280px]')}>
                <p className="line-clamp-3 text-white/80">{item.description}</p>
              </td>
              <td className={cellClassName}>
                <div className="space-y-2">
                  <Badge variant="secondary">{categoryLabels[item.categoryId] ?? item.categoryId}</Badge>
                  <p className="text-xs text-white/70">{subcategoryLabels[item.subcategoryId] ?? '—'}</p>
                </div>
              </td>
              <td className={cellClassName}>
                <div className="space-y-2">
                  <Badge variant={item.isNew ? 'success' : 'warning'}>{item.isNew ? 'Yeni' : 'İşlənmiş'}</Badge>
                  <p className="text-xs text-white/60">{formatDate(item.postedAt)}</p>
                </div>
              </td>
              <td className={cellClassName}>
                <p className="font-semibold text-white">{formatPrice(item.price)}</p>
                <p className="text-xs text-white/60">Favorit: {formatNumber(item.favoriteCount)}</p>
              </td>
              <td className={cellClassName}>
                <div className="space-y-1">
                  <p className="font-medium text-white">{item.sellerName}</p>
                  <p className="text-xs text-white/60">{item.sellerType === 'store' ? 'Mağaza' : 'Fərdi satıcı'}</p>
                  {item.sellerHandle && <p className="text-xs text-white/50">{item.sellerHandle}</p>}
                </div>
              </td>
              <td className={cellClassName}>
                <div className="space-y-1 text-xs text-white/80">
                  <p>Baxış: {formatNumber(item.viewCount)}</p>
                  <p>Şəhər: {item.city}</p>
                </div>
              </td>
              <td className={cellClassName}>
                <a
                  href={item.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-sky-400 hover:bg-sky-400/10"
                >
                  Tap.az
                  <ExternalLink className="size-4" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

