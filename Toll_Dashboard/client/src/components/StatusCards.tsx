import type { FiltersResponse, SummaryResponse } from '../lib/api';
import { useFilters, type FilterKey } from '../lib/useFilters';
import { TONE_COLORS } from './StatusPill';
import { STATUS_FIELD_LABELS } from '../lib/labels';

const FIELD_TO_FILTER: Record<string, { label: string; key: FilterKey; optionsField: keyof FiltersResponse['statusOptions'] }> = {
  civil: { label: STATUS_FIELD_LABELS.civil, key: 'civil', optionsField: 'civil' },
  layout: { label: STATUS_FIELD_LABELS.layout, key: 'layout', optionsField: 'layout' },
  system_integrator: { label: STATUS_FIELD_LABELS.system_integrator, key: 'si', optionsField: 'system_integrator' },
  toll_notification: { label: STATUS_FIELD_LABELS.toll_notification, key: 'notification', optionsField: 'toll_notification' },
  toll_operator: { label: STATUS_FIELD_LABELS.toll_operator, key: 'operator', optionsField: 'toll_operator' },
};

export function StatusCards({ cards, filters }: { cards: SummaryResponse['cards']; filters: FiltersResponse }) {
  const { state, toggleStatus } = useFilters();

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => {
        const meta = FIELD_TO_FILTER[card.field];
        if (!meta) return null;

        const vocab = filters.statusOptions[meta.optionsField];
        const byId = new Map(card.rows.map((r) => [r.statusId, r]));
        // "Not updated" row removed from status cards on user request (2026-11-05).
        // Blank-status plazas are still counted in the KPI "Toll Plazas" total; the
        // card total shown here is now the number of plazas with a known status.
        const rows: Array<{ id: string; label: string; tone: string; n: number }> = vocab.map((o) => {
          const row = byId.get(o.id);
          return { id: String(o.id), label: o.label, tone: o.tone, n: row?.n ?? 0 };
        });
        const total = rows.reduce((a, r) => a + r.n, 0);

        return (
          <div key={card.field} className="bg-card border border-bord rounded-lg p-4 flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-heading font-semibold text-sm uppercase tracking-wide text-grey">
                {meta.label}
              </h3>
              <div className="num text-count text-ink">{total}</div>
            </div>
            {total > 0 && (
              <div className="flex rounded overflow-hidden h-2 mb-3 bg-page">
                {rows
                  .filter((r) => r.n > 0)
                  .map((r) => (
                    <div
                      key={r.id}
                      title={`${r.label}: ${r.n}`}
                      className={TONE_COLORS[r.tone] ?? 'bg-grey'}
                      style={{ width: `${(r.n / total) * 100}%` }}
                    />
                  ))}
              </div>
            )}
            <ul className="space-y-1.5">
              {rows.map((r) => {
                const active = state[meta.key] === r.id;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => toggleStatus(meta.key, r.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border hover:bg-page ${
                        active ? 'border-accent bg-accent/5' : 'border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${TONE_COLORS[r.tone] ?? 'bg-grey'}`} />
                        <span className="text-sm font-medium truncate text-ink">{r.label}</span>
                      </span>
                      <span className="num font-semibold text-ink">{r.n}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
