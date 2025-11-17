import clsx from 'clsx';
import { SORT_FIELDS } from '@/lib/constants';
import { SortField } from '@/lib/types';

interface SortBarProps {
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  total: number;
  onSortChange: (field: SortField, direction: 'asc' | 'desc') => void;
}

export default function SortBar({ sortField, sortDirection, total, onSortChange }: SortBarProps) {
  const toggleDirection = () => onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc');

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/50">Ümumi nəticə</p>
        <p className="text-xl font-semibold text-white">{total.toLocaleString('az-Latn-AZ')} elan</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-white/70">Sırala</label>
        <select
          value={sortField}
          onChange={(event) => onSortChange(event.target.value as SortField, sortDirection)}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-sky-400 focus:outline-none"
        >
          {Object.entries(SORT_FIELDS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleDirection}
          className={clsx(
            'rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-wide transition',
            sortDirection === 'desc'
              ? 'border-sky-400 bg-sky-400/10 text-white'
              : 'border-white/10 bg-white/5 text-white/70 hover:border-white/30'
          )}
        >
          {sortDirection === 'desc' ? 'Azalan' : 'Artan'}
        </button>
      </div>
    </div>
  );
}

