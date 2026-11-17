import type { FiltersResponse, PlazaRow } from '../lib/api';
import { StatusPill } from './StatusPill';
import { NOT_ASSIGNED, STATUS_FIELD_LABELS } from '../lib/labels';

type Props = {
  rows: PlazaRow[];
  filters: FiltersResponse;
  onRowClick: (id: number) => void;
};

function findOpt(field: keyof FiltersResponse['statusOptions'], id: number | null, filters: FiltersResponse) {
  if (id == null) return { label: null, tone: 'neutral' };
  const opt = filters.statusOptions[field].find((o) => o.id === id);
  return opt ? { label: opt.label, tone: opt.tone } : { label: null, tone: 'neutral' };
}

export function PlazaTable({ rows, filters, onRowClick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="bg-card border border-bord rounded-lg p-8 text-center">
        <p className="text-grey">No toll plazas match the current filters.</p>
      </div>
    );
  }
  return (
    <div className="bg-card border border-bord rounded-lg">
      {/* Desktop table — fixed layout + wrapping headers so the table always fits its container.
          IMPORTANT: no ancestor between <th> and the viewport may have overflow:hidden/auto/scroll,
          or sticky silently stops working. The wrapper above intentionally has no overflow rule. */}
      <div className="hidden lg:block">
        <table className="w-full text-[13px] table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: '3%' }} />{/* S.No (positional) */}
            <col style={{ width: '7%' }} />{/* Toll Plaza Code */}
            <col style={{ width: '15%' }} />{/* Name of Road */}
            <col style={{ width: '5%' }} />{/* Chainage */}
            <col style={{ width: '6%' }} />{/* SH/Bridges Name */}
            <col style={{ width: '4%' }} />{/* APC */}
            <col style={{ width: '9%' }} />{/* Type of Plaza */}
            <col style={{ width: '8%' }} />{/* Location Finalized */}
            <col style={{ width: '9%' }} />{/* Civil */}
            <col style={{ width: '8%' }} />{/* Layout */}
            <col style={{ width: '9%' }} />{/* SI */}
            <col style={{ width: '9%' }} />{/* Notification */}
            <col style={{ width: '8%' }} />{/* Operator */}
          </colgroup>
          <thead>
            <tr>
              <Th>S.No</Th>
              <Th>Toll Plaza Code</Th>
              <Th>Name of Road</Th>
              <Th>Chainage</Th>
              <Th>SH/Bridges Name</Th>
              <Th>APC</Th>
              <Th>Type of Plaza</Th>
              <Th>Location Finalized</Th>
              <Th>{STATUS_FIELD_LABELS.civil}</Th>
              <Th>{STATUS_FIELD_LABELS.layout}</Th>
              <Th>{STATUS_FIELD_LABELS.system_integrator}</Th>
              <Th>{STATUS_FIELD_LABELS.toll_notification}</Th>
              <Th>{STATUS_FIELD_LABELS.toll_operator}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const civil = findOpt('civil', r.civilId, filters);
              const layout = findOpt('layout', r.layoutId, filters);
              const si = findOpt('system_integrator', r.siId, filters);
              const notif = findOpt('toll_notification', r.notificationId, filters);
              const op = findOpt('toll_operator', r.operatorId, filters);
              return (
                <tr
                  key={r.id}
                  onClick={() => onRowClick(r.id)}
                  className="hover:bg-page cursor-pointer"
                >
                  <Td mono bold>{idx + 1}</Td>
                  <Td bold title={r.plazaCode ?? NOT_ASSIGNED} truncate>
                    {r.plazaCode || <span className="font-semibold text-ink">{NOT_ASSIGNED}</span>}
                  </Td>
                  <Td truncate title={r.roadName}>{r.roadName}</Td>
                  <Td mono truncate>{r.chainageRaw ?? '—'}</Td>
                  <Td truncate>{r.shName ?? '—'}</Td>
                  <Td mono truncate>{r.apc ?? '—'}</Td>
                  <Td truncate title={r.plazaTypeRaw ?? ''}>{r.plazaTypeRaw ?? '—'}</Td>
                  <Td truncate title={r.locationFinalized ?? ''}>{r.locationFinalized ?? '—'}</Td>
                  <Td><StatusPill label={civil.label} tone={civil.tone} /></Td>
                  <Td><StatusPill label={layout.label} tone={layout.tone} /></Td>
                  <Td><StatusPill label={si.label} tone={si.tone} /></Td>
                  <Td><StatusPill label={notif.label} tone={notif.tone} /></Td>
                  <Td><StatusPill label={op.label} tone={op.tone} /></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile/tablet: stacked card variant */}
      <ul className="lg:hidden divide-y divide-bord">
        {rows.map((r, idx) => {
          const civil = findOpt('civil', r.civilId, filters);
          const layout = findOpt('layout', r.layoutId, filters);
          const si = findOpt('system_integrator', r.siId, filters);
          const notif = findOpt('toll_notification', r.notificationId, filters);
          const op = findOpt('toll_operator', r.operatorId, filters);
          return (
            <li key={r.id} onClick={() => onRowClick(r.id)} className="p-4 cursor-pointer hover:bg-page">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="num shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold bg-page text-grey rounded">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-heading font-semibold text-ink truncate">
                      {r.plazaCode || <span className="text-ink">{NOT_ASSIGNED}</span>}
                    </div>
                    <div className="text-sm text-grey truncate">{r.roadName}</div>
                  </div>
                </div>
                <div className="text-right text-xs text-grey shrink-0">
                  <div>{r.shName}</div>
                  <div className="num">{r.chainageRaw ?? '—'}</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusPill label={civil.label} tone={civil.tone} />
                <StatusPill label={layout.label} tone={layout.tone} />
                <StatusPill label={si.label} tone={si.tone} />
                <StatusPill label={notif.label} tone={notif.tone} />
                <StatusPill label={op.label} tone={op.tone} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="sticky z-10 bg-header text-white px-2 py-2 text-left font-heading font-semibold text-[11px] leading-tight uppercase tracking-wide align-bottom whitespace-normal break-words shadow-[0_2px_4px_-1px_rgba(0,0,0,0.35)] first:rounded-tl-lg last:rounded-tr-lg"
      style={{ top: 'var(--app-header-height, 0px)' }}
    >
      {children}
    </th>
  );
}

function Td({
  children, bold, mono, truncate, title,
}: {
  children: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
  truncate?: boolean;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={`px-2 py-2 align-middle text-ink border-t border-bord ${bold ? 'font-semibold' : ''} ${mono ? 'num' : ''} ${truncate ? 'truncate overflow-hidden whitespace-nowrap' : ''}`}
    >
      {children}
    </td>
  );
}
