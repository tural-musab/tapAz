interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function PaginationControls({ page, totalPages, total, pageSize, onPageChange }: PaginationControlsProps) {
  const handlePrevious = () => onPageChange(Math.max(1, page - 1));
  const handleNext = () => onPageChange(Math.min(totalPages, page + 1));

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
      <p>
        {total > 0 ? (
          <>
            {from}-{to} / {total} elan
          </>
        ) : (
          'Nəticə yoxdur'
        )}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={page === 1}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:text-white/30"
        >
          Əvvəlki
        </button>
        <span className="text-xs text-white/60">
          Səhifə {page}/{totalPages}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={page === totalPages || total === 0}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition disabled:cursor-not-allowed disabled:text-white/30"
        >
          Növbəti
        </button>
      </div>
    </div>
  );
}

