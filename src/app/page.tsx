import Dashboard from '@/components/dashboard/Dashboard';
import { getCategories, queryListings } from '@/lib/data';

export default function Home() {
  const categories = getCategories();
  const initialData = queryListings({ filters: {}, sortField: 'views', sortDirection: 'desc', page: 1 });

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(79,70,229,0.35),_transparent_40%)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Tap.az Data Ops</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-white md:text-5xl">
            Satıcılar üçün Baxış və Qiymət Analitikası
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/70">
            Tap.az elanlarından toplanan kateqoriya/subkateqoriya əsaslı göstəricilər. İstifadəçi girişinə ehtiyac
            olmadan real vaxt filtrləri, baxış statistikası və mağaza performansını izləyin.
          </p>
        </div>
        <div className="mt-12">
          <Dashboard categories={categories} initialData={initialData} />
        </div>
      </div>
    </main>
  );
}
