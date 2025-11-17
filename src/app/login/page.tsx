'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? 'Giriş uğursuz oldu');
      }

      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl shadow-black/40">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Tap.az Analytics</p>
          <h1 className="text-2xl font-semibold text-white">Panelə daxil ol</h1>
          <p className="text-sm text-slate-400">İstifadəçi adı və şifrə ilə giriş edin</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300">
            İstifadəçi adı
            <input
              type="text"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm text-slate-300">
            Şifrə
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-500/90 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Yoxlanır...' : 'Daxil ol'}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-slate-800/60 bg-slate-950/30 p-4 text-sm text-slate-400">
          <p className="font-semibold text-slate-200">Demo giriş məlumatları</p>
          <p className="mt-2">Admin: <span className="font-mono text-emerald-300">tapaz_admin / Admin!2024</span></p>
          <p>Normal: <span className="font-mono text-emerald-300">tapaz_user / User!2024</span></p>
          <p className="mt-2 text-xs text-slate-500">Şifrələri `.env.local` daxilindəki `AUTH_*` dəyişənləri ilə dəyişə bilərsiniz.</p>
        </div>
      </div>
    </div>
  );
}
