import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/layout/AppHeader';
import { readSession } from '@/lib/auth/session';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'Tap.az Satıcı Analitik Portalı',
  description:
    'Tap.az elanlarından kateqoriya/subkateqoriya əsaslı baxış sayı, qiymət və trend analitikası təqdim edən panel.',
  metadataBase: new URL('https://tap.az'),
  openGraph: {
    title: 'Tap.az Satıcı Analitik Portalı',
    description: 'Baxış sayı və qiymət trendlərinə real vaxt baxış.',
    url: 'https://tap.az',
    siteName: 'Tap.az Analitika',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tap.az Satıcı Analitik Portalı',
    description: 'Satıcılar üçün baxış sayı əsaslı analitika.'
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();

  return (
    <html lang="az">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 antialiased`}>
        <AppHeader session={session} />
        {children}
      </body>
    </html>
  );
}
