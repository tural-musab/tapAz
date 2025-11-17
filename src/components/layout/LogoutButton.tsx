'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export const LogoutButton = () => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    startTransition(() => {
      router.push('/login');
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg bg-slate-800/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
      disabled={isPending}
    >
      {isPending ? 'Çıxılır...' : 'Çıxış'}
    </button>
  );
};
