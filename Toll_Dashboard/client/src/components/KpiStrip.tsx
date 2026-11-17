import type { KpiBundle } from '../lib/api';
import { useAnimatedNumber } from '../lib/useAnimatedNumber';

type Props = {
  kpis: KpiBundle;
  title?: string;
  subtitle?: string;
};

export function KpiStrip({ kpis, title, subtitle }: Props) {
  // "Total Structure Length" removed on user request (2026-11-04).
  // The server still returns kpis.structureKm; UI simply doesn't display it.
  // Location Finalized / BSRDC / BRPNNL added 2026-11-05.
  const items = [
    { label: 'Toll Plazas', value: kpis.plazas, suffix: '' },
    { label: 'Total Road Length', value: kpis.roadKm, suffix: 'km', fixed: 1 },
    { label: 'Divisions Covered', value: kpis.divisions, suffix: '' },
    { label: 'Not Feasible', value: kpis.notFeasible, suffix: '' },
    { label: 'Location Finalized', value: kpis.locationFinalized, suffix: '' },
    { label: 'BSRDC', value: kpis.bsrdc, suffix: '' },
    { label: 'BRPNNL', value: kpis.brpnnl, suffix: '' },
  ];
  return (
    <section className="mb-6" aria-label={title ?? 'Key performance indicators'} aria-live="polite">
      {title && (
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="font-heading font-semibold text-xs uppercase tracking-wide text-grey">{title}</h2>
          {subtitle && <span className="text-xs text-grey">{subtitle}</span>}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {items.map((it) => <KpiCard key={it.label} {...it} />)}
      </div>
    </section>
  );
}

function KpiCard({ label, value, suffix, fixed }: { label: string; value: number; suffix: string; fixed?: number }) {
  const animated = useAnimatedNumber(value);
  const display = fixed != null ? animated.toFixed(fixed) : Math.round(animated).toLocaleString('en-IN');
  return (
    <div className="bg-card border border-bord rounded-lg p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-grey">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="num text-kpi text-ink" aria-label={`${label}: ${display}${suffix ? ' ' + suffix : ''}`}>{display}</div>
        {suffix && <div className="text-sm font-semibold text-grey">{suffix}</div>}
      </div>
    </div>
  );
}
