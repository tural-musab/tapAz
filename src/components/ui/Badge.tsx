import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
}

const variants = {
  primary: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
  secondary: 'bg-white/10 text-white border-white/20',
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-200 border-amber-500/30'
};

export default function Badge({ children, variant = 'primary' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold', variants[variant])}>
      {children}
    </span>
  );
}

