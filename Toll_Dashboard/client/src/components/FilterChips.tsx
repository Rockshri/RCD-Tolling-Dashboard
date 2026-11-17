import type { FiltersResponse } from '../lib/api';
import { useFilters, type FilterKey } from '../lib/useFilters';
import { STATUS_FIELD_LABELS } from '../lib/labels';

type Props = { filters: FiltersResponse };

const STATUS_FIELDS: Array<{ key: FilterKey; label: string; field: keyof FiltersResponse['statusOptions'] }> = [
  { key: 'civil', label: STATUS_FIELD_LABELS.civil, field: 'civil' },
  { key: 'layout', label: STATUS_FIELD_LABELS.layout, field: 'layout' },
  { key: 'si', label: STATUS_FIELD_LABELS.system_integrator, field: 'system_integrator' },
  { key: 'notification', label: STATUS_FIELD_LABELS.toll_notification, field: 'toll_notification' },
  { key: 'operator', label: STATUS_FIELD_LABELS.toll_operator, field: 'toll_operator' },
];

export function FilterChips({ filters }: Props) {
  const { state, set, clearAll } = useFilters();

  const chips: Array<{ key: FilterKey; label: string }> = [];
  if (state.zone) {
    const z = filters.zones.find((x) => String(x.id) === state.zone);
    if (z) chips.push({ key: 'zone', label: `Zone: ${z.name}` });
  }
  if (state.division) {
    const d = filters.divisions.find((x) => String(x.id) === state.division);
    if (d) chips.push({ key: 'division', label: `Division: ${d.name}` });
  }
  for (const { key, label, field } of STATUS_FIELDS) {
    const v = state[key];
    if (!v) continue;
    if (v === 'none') { chips.push({ key, label: `${label}: Not updated` }); continue; }
    const opt = filters.statusOptions[field].find((o) => String(o.id) === v);
    if (opt) chips.push({ key, label: `${label}: ${opt.label}` });
  }
  if (state.locationFinalized) {
    const lbl = state.locationFinalized === 'none' ? 'Not updated' : state.locationFinalized;
    chips.push({ key: 'locationFinalized', label: `Location Finalized: ${lbl}` });
  }
  if (state.entryType) {
    const lbl = state.entryType === 'bridge' ? 'Bridge' : 'SH-#';
    chips.push({ key: 'entryType', label: `SH / Bridge: ${lbl}` });
  }
  if (state.q) chips.push({ key: 'q', label: `Search: "${state.q}"` });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.key + c.label}
          onClick={() => set(c.key, undefined)}
          className="group inline-flex items-center gap-1.5 bg-accent/10 border border-accent/30 text-ink text-sm px-2.5 py-1 rounded-full hover:bg-accent/20"
        >
          <span>{c.label}</span>
          <span aria-hidden className="text-accent font-bold">×</span>
          <span className="sr-only">remove filter</span>
        </button>
      ))}
      <button onClick={clearAll} className="text-sm underline text-accent">Clear all</button>
    </div>
  );
}
