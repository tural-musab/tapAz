import Link from 'next/link';
import { LogoutButton } from '@/components/layout/LogoutButton';
import type { SessionInfo } from '@/lib/auth/session';

interface AppHeaderProps {
  session: SessionInfo;
}

export const AppHeader = ({ session }: AppHeaderProps) => (
  <header className="border-b border-slate-900/60 bg-slate-950/80">
    <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 text-sm text-slate-300 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">tap.az</p>
        <p className="text-base font-semibold text-white">Satıcı Analitika Paneli</p>
      </div>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/" className="text-slate-300 transition hover:text-white">
          Əsas səhifə
        </Link>
        {session.role === 'admin' && (
          <Link href="/admin" className="text-slate-300 transition hover:text-white">
            Admin paneli
          </Link>
        )}
      </nav>
      <div className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 px-3 py-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {session.role === 'admin' ? 'Administrator' : session.role === 'user' ? 'İstifadəçi' : 'Giriş tələb olunur'}
          </p>
          <p className="text-sm font-semibold text-white">{session.username ?? 'Anonim'}</p>
        </div>
        {session.role && <LogoutButton />}
      </div>
    </div>
  </header>
);
