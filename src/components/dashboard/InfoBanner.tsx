import { ShieldAlert } from 'lucide-react';

export default function InfoBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-amber-50">
      <ShieldAlert className="mt-0.5 size-5 flex-shrink-0 text-amber-300" />
      <div className="space-y-1 text-sm leading-relaxed">
        <p className="font-semibold uppercase tracking-wide text-amber-200">İş elanları istisna edilir</p>
        <p className="text-amber-100/90">
          Müştərinin göstərişinə əsasən “İş elanları” kateqoriyası bütün filtr, statistik və hesabat mərhələlərindən
          avtomatik çıxarılır. Digər kateqoriyalar real vaxtda analiz olunur.
        </p>
      </div>
    </div>
  );
}

