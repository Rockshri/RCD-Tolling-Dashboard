import { useEffect, useState } from 'react';
import type { FiltersResponse } from '../lib/api';
import { useFilters, type FilterKey } from '../lib/useFilters';
import { STATUS_FIELD_LABELS } from '../lib/labels';

type Props = { filters: FiltersResponse };

const STATUS_FILTERS: Array<{ key: FilterKey; label: string; field: keyof FiltersResponse['statusOptions'] }> = [
  { key: 'civil', label: STATUS_FIELD_LABELS.civil, field: 'civil' },
  { key: 'layout', label: STATUS_FIELD_LABELS.layout, field: 'layout' },
  { key: 'si', label: STATUS_FIELD_LABELS.system_integrator, field: 'system_integrator' },
  { key: 'notification', label: STATUS_FIELD_LABELS.toll_notification, field: 'toll_notification' },
  { key: 'operator', label: STATUS_FIELD_LABELS.toll_operator, field: 'toll_operator' },
];

export function FilterBar({ filters }: Props) {
  const { state, set, clearAll } = useFilters();
  const [search, setSearch] = useState(state.q ?? '');

  useEffect(() => { setSearch(state.q ?? ''); }, [state.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((state.q ?? '') !== search) set('q', search || undefined);
    }, 300);
    return () => clearTimeout(t);

  }, [search]);

  const anyActive = Object.values(state).some((v) => v);
  const zoneDisabled = filters.divisions.every((d) => d.zoneId == null);

  return (
    <section className="bg-card border border-bord rounded-lg p-4 mb-6" aria-label="Filters">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label={zoneDisabled ? 'Zone (mapping not supplied)' : 'Zone'}
          value={state.zone}
          disabled={zoneDisabled}
          onChange={(v) => set('zone', v)}
          options={filters.zones.map((z) => ({ value: String(z.id), label: z.name }))}
        />
        <Select
          label="Division"
          value={state.division}
          onChange={(v) => {
            set('division', v);
          }}
          options={filters.divisions
            .filter((d) => !state.zone || String(d.zoneId) === state.zone)
            .map((d) => ({ value: String(d.id), label: d.name }))}
        />
        {STATUS_FILTERS.map(({ key, label, field }) => (
          <Select
            key={key}
            label={label}
            value={state[key]}
            onChange={(v) => set(key, v)}
            // "Not updated" is intentionally NOT in the dropdown (user request, 2026-11-04).
            // The status card's "Not updated" row still shows the blank count and clicking it
            // still filters via ?field=none; the active-filter chip lets the user clear it.
            options={filters.statusOptions[field].map((o) => ({ value: String(o.id), label: o.label }))}
          />
        ))}
        <Select
          label="Location Finalized"
          value={state.locationFinalized}
          onChange={(v) => set('locationFinalized', v)}
          options={filters.locationFinalizedOptions.map((o) => ({ value: o, label: o }))}
        />
        <Select
          label="SH / Bridge"
          value={state.entryType}
          onChange={(v) => set('entryType', v)}
          options={[
            { value: 'road', label: 'SH-#' },
            { value: 'bridge', label: 'Bridge' },
          ]}
        />
        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-grey mb-1">Search (road, plaza, SH)</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search…"
              className="w-full border border-bord bg-card text-ink rounded px-3 py-2 outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={clearAll}
            disabled={!anyActive}
            className="px-4 py-2 rounded border border-bord bg-card hover:bg-page disabled:opacity-40 font-semibold"
          >
            Clear all
          </button>
        </div>
      </div>
    </section>
  );
}

function Select({
  label, value, onChange, options, disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-grey mb-1">{label}</label>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full border border-bord bg-card text-ink rounded px-3 py-2 outline-none focus:border-accent disabled:bg-page disabled:cursor-not-allowed"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
