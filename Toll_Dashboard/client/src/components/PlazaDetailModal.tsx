import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type FiltersResponse, type PlazaDetail } from '../lib/api';
import { StatusPill } from './StatusPill';
import { NOT_ASSIGNED, NOT_UPDATED, STATUS_FIELD_LABELS, type StatusFieldKey } from '../lib/labels';

type Props = {
  plazaId: number | null;
  filters: FiltersResponse;
  onClose: () => void;
};

function findOpt(field: keyof FiltersResponse['statusOptions'], id: number | null, filters: FiltersResponse) {
  if (id == null) return { label: null, tone: 'neutral' };
  const opt = filters.statusOptions[field].find((o) => o.id === id);
  return opt ? { label: opt.label, tone: opt.tone } : { label: null, tone: 'neutral' };
}

export function PlazaDetailModal({ plazaId, filters, onClose }: Props) {
  const nav = useNavigate();
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const [data, setData] = useState<PlazaDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (plazaId != null && !dlg.open) {
      dlg.showModal();
      // Prevent background scroll while modal is open.
      document.body.style.overflow = 'hidden';
    } else if (plazaId == null && dlg.open) {
      dlg.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [plazaId]);

  useEffect(() => {
    if (plazaId == null) { setData(null); return; }
    setLoading(true);
    api<PlazaDetail>(`/plazas/${plazaId}`).then(setData).finally(() => setLoading(false));
  }, [plazaId]);

  // Esc + backdrop close via dialog's native 'close' + explicit backdrop click.
  function onDialogClose() { onClose(); }
  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dlgRef.current) onClose();
  }

  const civil = data ? findOpt('civil', data.civilStatusId, filters) : null;
  const layout = data ? findOpt('layout', data.layoutStatusId, filters) : null;
  const si = data ? findOpt('system_integrator', data.siStatusId, filters) : null;
  const notif = data ? findOpt('toll_notification', data.notificationStatusId, filters) : null;
  const op = data ? findOpt('toll_operator', data.operatorStatusId, filters) : null;

  const title = data
    ? (data.plazaCode?.trim() ? data.plazaCode : data.roadName)
    : (loading ? 'Loading…' : '');

  const statusRows: Array<{ key: StatusFieldKey; label: string; value: { label: string | null; tone: string } | null }> = data
    ? [
      { key: 'civil', label: STATUS_FIELD_LABELS.civil, value: civil },
      { key: 'layout', label: STATUS_FIELD_LABELS.layout, value: layout },
      { key: 'system_integrator', label: STATUS_FIELD_LABELS.system_integrator, value: si },
      { key: 'toll_notification', label: STATUS_FIELD_LABELS.toll_notification, value: notif },
      { key: 'toll_operator', label: STATUS_FIELD_LABELS.toll_operator, value: op },
    ]
    : [];

  return (
    <dialog
      ref={dlgRef}
      aria-labelledby="plaza-modal-title"
      className="plaza-modal p-0 rounded-lg w-[min(720px,calc(100vw-32px))] max-h-[90vh] max-w-none bg-card text-ink border border-bord backdrop:bg-black/50"
      onClose={onDialogClose}
      onClick={onBackdropClick}
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="sticky top-0 bg-header text-white px-5 py-4 flex items-center justify-between">
          <h2 id="plaza-modal-title" className="font-heading font-semibold text-lg truncate">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {data && (
            <>
              {!data.plazaCode?.trim() && (
                <div className="text-sm text-grey">Toll Plaza Code: <span className="font-semibold">{NOT_ASSIGNED}</span></div>
              )}

              <Section title="Location">
                <KV k="Road" v={data.roadName} />
                <KV k="SH Name" v={data.shName} />
                <KV k="Division" v={data.divisionName} />
                <KV k="Village" v={data.villageName} />
                <KV k="Chainage" v={data.chainageRaw} mono />
                <KV k="Latitude" v={data.latitude} mono />
                <KV k="Longitude" v={data.longitude} mono />
                {data.coordsNeedReview && (
                  <div className="col-span-2 text-xs font-semibold text-warn bg-warn/10 border border-warn/30 rounded px-2 py-1">
                    Coordinates need review
                  </div>
                )}
              </Section>

              <Section title="Road and Plaza">
                <KV k="Type of Plaza" v={data.plazaTypeRaw} />
                <KV k="APC" v={data.apc} mono />
                <KV k="Location Finalized" v={data.locationFinalized ?? 'Not updated'} bold />
                <KV k="Road 2 Lane" v={fmtKm(data.roadLen2laneKm)} />
                <KV k="Road >=4 Lane" v={fmtKm(data.roadLen4laneKm)} />
                <KV k="Struct 2 Lane" v={fmtKm(data.structLen2laneKm)} />
                <KV k="Struct >=4 Lane" v={fmtKm(data.structLen4laneKm)} />
                <KV k="Total Road" v={fmtKm(data.roadLenTotalKm)} bold />
                <KV k="Total Structure" v={fmtKm(data.structLenTotalKm)} bold />
                <KV k="Total Length" v={fmtKm(data.totalLenKm)} bold />
                <KV k="Equivalent Length" v={fmtKm(data.equivalentLenKm)} bold />
              </Section>

              <section>
                <h3 className="font-heading font-semibold text-sm uppercase tracking-wide text-grey mb-2">Status</h3>
                <ul className="divide-y divide-bord border border-bord rounded">
                  {statusRows.map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <span className="font-semibold text-ink text-sm sm:text-base">{r.label}</span>
                      <StatusPill label={r.value?.label ?? null} tone={r.value?.tone ?? null} />
                    </li>
                  ))}
                </ul>
              </section>

              <Section title="Attachments">
                {data.files.length === 0 && <div className="col-span-2 text-sm text-grey">No files uploaded.</div>}
                {data.files.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/plazas/${data.id}/files/${f.id}`}
                    className="col-span-2 flex items-center justify-between border border-bord rounded px-3 py-2 hover:bg-page"
                  >
                    <span className="truncate">
                      <span className="font-semibold">{f.kind === 'pdf' ? 'PDF' : 'Image'}:</span> {f.originalName}
                    </span>
                    <span className="text-xs text-grey">{(f.sizeBytes / 1024).toFixed(0)} KB</span>
                  </a>
                ))}
              </Section>
            </>
          )}
          {NOT_UPDATED && null /* keep import alive */}
        </div>

        {data && (
          <div className="sticky bottom-0 bg-card border-t border-bord px-5 py-3 flex gap-2">
            <button
              onClick={() => nav(`/plazas/${data.id}/edit`)}
              className="bg-accent text-white font-semibold px-4 py-2 rounded"
            >
              Edit
            </button>
            <a
              href={`/api/plazas/${data.id}/download`}
              className="border border-bord text-ink font-semibold px-4 py-2 rounded hover:bg-page"
            >
              Download PDF
            </a>
            <a
              href={`/api/plazas/${data.id}/download-all`}
              className="border border-bord text-ink font-semibold px-4 py-2 rounded hover:bg-page"
            >
              Download all (ZIP)
            </a>
          </div>
        )}
      </div>
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-heading font-semibold text-sm uppercase tracking-wide text-grey mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>
    </section>
  );
}
function KV({ k, v, mono, bold }: { k: string; v: React.ReactNode; mono?: boolean; bold?: boolean }) {
  return (
    <>
      <div className="text-xs text-grey">{k}</div>
      <div className={`text-sm ${mono ? 'num' : ''} ${bold ? 'font-semibold' : ''}`}>{v || '—'}</div>
    </>
  );
}
function fmtKm(v: string | null): string | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? `${n} km` : v;
}
