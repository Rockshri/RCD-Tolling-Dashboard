import { useEffect, useRef, useState } from 'react';
import { api, type SummaryResponse } from '../lib/api';
import { useFilters, type FilterKey } from '../lib/useFilters';
import { NOT_ASSIGNED } from '../lib/labels';

type ChartsData = {
  // perDivision kept on the server response but unused on the client (Change 2026-11-03).
  perDivision?: Array<{ division: string; civil_label: string; tone: string; n: number }>;
  typeMix: Array<{ type: string; n: number }>;
};

type TypePlazas = {
  type: string;
  rows: Array<{ id: number; plazaCode: string | null; roadName: string; divisionName: string | null }>;
};

const TONE_HEX: Record<string, string> = {
  done: '#17803d', progress: '#b3630c', pending: '#b32219', not_feasible: '#2b333d', neutral: '#5a6773',
};

const PALETTE = ['#0c5f64', '#17803d', '#b3630c', '#b32219', '#2b333d', '#5a6773', '#1a9ba3', '#5e3a9a', '#8a7a0b'];

type Props = {
  cards: SummaryResponse['cards'];
  queryString: string;
  onOpenPlaza: (id: number) => void;
};

export function Charts({ cards, queryString, onOpenPlaza }: Props) {
  const [data, setData] = useState<ChartsData | null>(null);
  const [selectedType, setSelectedType] = useState<{ label: string; raw: string } | null>(null);

  useEffect(() => {
    api<ChartsData>(`/charts${queryString}`).then(setData).catch(() => setData(null));
  }, [queryString]);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6" aria-label="Charts">
      <div className="bg-card border border-bord rounded-lg p-4 lg:col-span-1">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide text-grey mb-3">
          Pipeline (counts)
        </h3>
        <Pipeline cards={cards} />
      </div>
      <div className="bg-card border border-bord rounded-lg p-4 lg:col-span-2">
        <h3 className="font-heading font-semibold text-sm uppercase tracking-wide text-grey mb-3">
          Plaza type mix
        </h3>
        {data
          ? <TypeMix rows={data.typeMix} onPick={(label, raw) => setSelectedType({ label, raw })} />
          : <Skeleton rows={4} />}
      </div>
      <PlazasOfTypeModal
        selected={selectedType}
        queryString={queryString}
        onClose={() => setSelectedType(null)}
        onOpenPlaza={(id) => { setSelectedType(null); onOpenPlaza(id); }}
      />
    </section>
  );
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-5 bg-page rounded" />
      ))}
    </div>
  );
}

function Pipeline({ cards }: { cards: SummaryResponse['cards'] }) {
  const STAGES: Array<{ key: string; label: string; filter: FilterKey }> = [
    { key: 'civil', label: 'Civil Work', filter: 'civil' },
    { key: 'layout', label: 'Layout', filter: 'layout' },
    { key: 'system_integrator', label: 'System Integrator', filter: 'si' },
    { key: 'toll_notification', label: 'Toll Notification', filter: 'notification' },
  ];
  const { set } = useFilters();
  const rowsByField: Record<string, SummaryResponse['cards'][number]['rows']> = {};
  for (const c of cards) rowsByField[c.field] = c.rows;
  return (
    <ul className="space-y-2">
      {STAGES.map((s) => {
        const rows = rowsByField[s.key] ?? [];
        const total = rows.reduce((a, r) => a + r.n, 0);
        return (
          <li key={s.key}>
            <div className="flex justify-between text-xs text-grey mb-1">
              <span>{s.label}</span>
              <span className="num font-semibold text-ink">{total}</span>
            </div>
            <div className="h-3 flex rounded overflow-hidden bg-page">
              {rows.filter((r) => r.n > 0).map((r) => (
                <button
                  key={String(r.statusId) + r.label}
                  title={`${r.label ?? 'Not updated'}: ${r.n}`}
                  onClick={() => set(s.filter, r.statusId == null ? 'none' : String(r.statusId))}
                  style={{ width: `${(r.n / Math.max(1, total)) * 100}%`, backgroundColor: TONE_HEX[r.tone ?? 'neutral'] }}
                  className="hover:brightness-110"
                />
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TypeMix({ rows, onPick }: { rows: ChartsData['typeMix']; onPick: (label: string, raw: string) => void }) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  // `rows[i].type` is the display label (empty text → 'Not specified' from the server).
  // For the lookup we pass the raw label back to the server; the server treats 'Not specified' as NULL/empty.
  return (
    <div>
      <div className="h-4 flex rounded overflow-hidden bg-page mb-2">
        {rows.slice(0, 9).map((r, i) => (
          <button
            key={r.type}
            type="button"
            title={`${r.type}: ${r.n}`}
            onClick={() => onPick(r.type, r.type)}
            style={{ width: `${(r.n / Math.max(1, total)) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            className="hover:brightness-110"
            aria-label={`Open plazas of type ${r.type}`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1 text-sm">
        {rows.slice(0, 9).map((r, i) => (
          <li key={r.type}>
            <button
              type="button"
              onClick={() => onPick(r.type, r.type)}
              className="w-full flex items-center gap-2 min-w-0 py-1 px-1 rounded hover:bg-page text-left"
              title={`${r.type} — click to see roads (${r.n})`}
            >
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-ink underline-offset-2 group-hover:underline">{r.type}</span>
              <span className="num text-grey ml-auto">{r.n}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlazasOfTypeModal({
  selected, queryString, onClose, onOpenPlaza,
}: {
  selected: { label: string; raw: string } | null;
  queryString: string;
  onClose: () => void;
  onOpenPlaza: (id: number) => void;
}) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const [data, setData] = useState<TypePlazas | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (selected && !dlg.open) {
      dlg.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!selected && dlg.open) {
      dlg.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  useEffect(() => {
    if (!selected) { setData(null); return; }
    const sep = queryString ? `${queryString}&` : '?';
    const url = `/plazas-by-type${sep}type=${encodeURIComponent(selected.raw)}`;
    setLoading(true);
    api<TypePlazas>(url).then(setData).finally(() => setLoading(false));
  }, [selected, queryString]);

  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dlgRef.current) onClose();
  }

  return (
    <dialog
      ref={dlgRef}
      aria-labelledby="type-modal-title"
      className="plaza-modal p-0 rounded-lg w-[min(640px,calc(100vw-32px))] max-h-[85vh] max-w-none bg-card text-ink border border-bord backdrop:bg-black/50"
      onClose={onClose}
      onClick={onBackdropClick}
    >
      <div className="flex flex-col max-h-[85vh]">
        <div className="sticky top-0 bg-header text-white px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-white/70 uppercase tracking-wide">Plaza type</div>
            <h2 id="type-modal-title" className="font-heading font-semibold text-base leading-tight break-words">
              {selected?.label ?? ''}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white text-xl leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-5 text-grey">Loading…</div>}
          {!loading && data && (
            <>
              <div className="px-5 py-2 text-xs text-grey border-b border-bord">
                {data.rows.length} {data.rows.length === 1 ? 'plaza' : 'plazas'} match the current filters
              </div>
              {data.rows.length === 0 ? (
                <div className="p-5 text-grey">No plazas of this type under the current filters.</div>
              ) : (
                <ul className="divide-y divide-bord">
                  {data.rows.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onOpenPlaza(r.id)}
                        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-page"
                      >
                        <span className="font-semibold text-sm text-ink shrink-0 w-28 truncate">
                          {r.plazaCode?.trim() || <span className="text-grey">{NOT_ASSIGNED}</span>}
                        </span>
                        <span className="flex-1 min-w-0 text-sm text-ink truncate" title={r.roadName}>
                          {r.roadName}
                        </span>
                        <span className="text-xs text-grey shrink-0">{r.divisionName ?? '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
