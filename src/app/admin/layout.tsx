import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Tap.az Admin Paneli',
  description: 'Toplayıcı parametrləri, gecə planı və monitorinq üçün idarəetmə paneli'
};

const NAV_LINKS = [
  { href: '#overview', label: 'Overview' },
  { href: '#manual', label: 'Manual collector' },
  { href: '#nightly', label: 'Night scheduler' },
  { href: '#activity', label: 'Activity log' }
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-slate-900 bg-slate-950/90 px-6 py-8 lg:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">tap.az</p>
            <p className="text-xl font-semibold text-white">Admin Control</p>
            <p className="mt-2 text-sm text-slate-400">Scraper · Supabase · Schedules</p>
          </div>
          <nav className="mt-8 space-y-1 text-sm font-medium text-slate-400">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-slate-400 transition hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-slate-900/80 bg-slate-900/40 p-4 text-xs text-slate-400">
            <p>Autentifikasiya üçün `ADMIN_DASHBOARD_TOKEN` dəyərləndirilir.</p>
            <p className="mt-1">`token` query param-ı və ya `x-admin-token` header-i ilə giriş mümkündür.</p>
          </div>
        </aside>
        <div className="flex-1">
          <header className="border-b border-slate-900/70 bg-slate-950/80 px-6 py-4 text-sm text-slate-400">
            <p>Son push-u Vercel deploy-larında izləyin · Supabase planları üçün service role açarı yalnız server tərəfdə saxlanılmalıdır</p>
          </header>
          <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
