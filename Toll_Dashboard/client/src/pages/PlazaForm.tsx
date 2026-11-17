import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type FiltersResponse, type PlazaDetail } from '../lib/api';
import { Header } from '../components/Header';
import { dashboardReturnUrl } from '../lib/dashboardReturn';

type Props = { mode: 'new' | 'edit' };

type FormState = {
  plazaCode: string;
  plazaName: string;
  roadName: string;
  shName: string;
  divisionId: string;
  villageName: string;
  chainageRaw: string;
  latitude: string;
  longitude: string;
  roadLen2laneKm: string;
  roadLen4laneKm: string;
  structLen2laneKm: string;
  structLen4laneKm: string;
  apc: string;
  plazaTypeRaw: string;
  locationFinalized: string;
  civilStatusId: string;
  layoutStatusId: string;
  siStatusId: string;
  notificationStatusId: string;
  operatorStatusId: string;
};

const empty: FormState = {
  plazaCode: '', plazaName: '', roadName: '', shName: '', divisionId: '', villageName: '',
  chainageRaw: '', latitude: '', longitude: '',
  roadLen2laneKm: '', roadLen4laneKm: '', structLen2laneKm: '', structLen4laneKm: '',
  apc: '', plazaTypeRaw: '', locationFinalized: '',
  civilStatusId: '', layoutStatusId: '', siStatusId: '', notificationStatusId: '', operatorStatusId: '',
};

export function PlazaForm({ mode }: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [state, setState] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [plazaId, setPlazaId] = useState<number | null>(null);
  const [files, setFiles] = useState<PlazaDetail['files']>([]);

  useEffect(() => {
    api<FiltersResponse>('/filters').then(setFilters);
  }, []);

  useEffect(() => {
    if (mode === 'edit' && id) {
      api<PlazaDetail>(`/plazas/${id}`).then((p) => {
        setPlazaId(p.id);
        setFiles(p.files);
        setState({
          plazaCode: p.plazaCode ?? '',
          plazaName: p.plazaName ?? '',
          roadName: p.roadName ?? '',
          shName: p.shName ?? '',
          divisionId: p.divisionId != null ? String(p.divisionId) : '',
          villageName: p.villageName ?? '',
          chainageRaw: p.chainageRaw ?? '',
          latitude: p.latitude ?? '',
          longitude: p.longitude ?? '',
          roadLen2laneKm: p.roadLen2laneKm ?? '',
          roadLen4laneKm: p.roadLen4laneKm ?? '',
          structLen2laneKm: p.structLen2laneKm ?? '',
          structLen4laneKm: p.structLen4laneKm ?? '',
          apc: p.apc ?? '',
          plazaTypeRaw: p.plazaTypeRaw ?? '',
          locationFinalized: p.locationFinalized ?? '',
          civilStatusId: p.civilStatusId != null ? String(p.civilStatusId) : '',
          layoutStatusId: p.layoutStatusId != null ? String(p.layoutStatusId) : '',
          siStatusId: p.siStatusId != null ? String(p.siStatusId) : '',
          notificationStatusId: p.notificationStatusId != null ? String(p.notificationStatusId) : '',
          operatorStatusId: p.operatorStatusId != null ? String(p.operatorStatusId) : '',
        });
      });
    }
  }, [mode, id]);

  const totals = useMemo(() => {
    const n = (s: string) => (s === '' ? 0 : Number(s) || 0);
    const r2 = n(state.roadLen2laneKm);
    const r4 = n(state.roadLen4laneKm);
    const s2 = n(state.structLen2laneKm);
    const s4 = n(state.structLen4laneKm);
    const roadTotal = r2 + r4;
    const structTotal = s2 + s4;
    const total = roadTotal + structTotal;
    const equivalent = Math.min(r2 + r4 + 10 * (s2 + s4), 5 * total);
    return { roadTotal, structTotal, total, equivalent };
  }, [state]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!state.roadName.trim()) e.roadName = 'Required';
    if (!state.shName.trim()) e.shName = 'Required';
    if (!state.divisionId) e.divisionId = 'Required';
    for (const k of ['roadLen2laneKm', 'roadLen4laneKm', 'structLen2laneKm', 'structLen4laneKm'] as const) {
      const v = state[k];
      if (v !== '' && Number(v) < 0) e[k] = 'Must be ≥ 0';
    }
    if (state.latitude !== '') {
      const n = Number(state.latitude);
      if (!Number.isFinite(n) || n < 24 || n > 28) e.latitude = 'Expected 24–28 for Bihar';
    }
    if (state.longitude !== '') {
      const n = Number(state.longitude);
      if (!Number.isFinite(n) || n < 83 || n > 89) e.longitude = 'Expected 83–89 for Bihar';
    }
    return e;
  }

  const valid = Object.keys(validate()).length === 0;

  async function save() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const body = {
      plazaCode: state.plazaCode || null,
      plazaName: state.plazaName || null,
      roadName: state.roadName,
      shName: state.shName,
      divisionId: Number(state.divisionId),
      villageName: state.villageName || null,
      chainageRaw: state.chainageRaw || null,
      latitude: state.latitude === '' ? null : Number(state.latitude),
      longitude: state.longitude === '' ? null : Number(state.longitude),
      roadLen2laneKm: state.roadLen2laneKm === '' ? null : Number(state.roadLen2laneKm),
      roadLen4laneKm: state.roadLen4laneKm === '' ? null : Number(state.roadLen4laneKm),
      structLen2laneKm: state.structLen2laneKm === '' ? null : Number(state.structLen2laneKm),
      structLen4laneKm: state.structLen4laneKm === '' ? null : Number(state.structLen4laneKm),
      apc: state.apc === '' ? null : Number(state.apc),
      plazaTypeRaw: state.plazaTypeRaw || null,
      locationFinalized: state.locationFinalized || null,
      civilStatusId: state.civilStatusId ? Number(state.civilStatusId) : null,
      layoutStatusId: state.layoutStatusId ? Number(state.layoutStatusId) : null,
      siStatusId: state.siStatusId ? Number(state.siStatusId) : null,
      notificationStatusId: state.notificationStatusId ? Number(state.notificationStatusId) : null,
      operatorStatusId: state.operatorStatusId ? Number(state.operatorStatusId) : null,
    };
    try {
      if (mode === 'new') {
        const row = await api<{ id: number }>('/plazas', { method: 'POST', body: JSON.stringify(body) });
        setPlazaId(row.id);
        nav(`/plazas/${row.id}/edit`, { replace: true });
      } else if (plazaId) {
        await api(`/plazas/${plazaId}`, { method: 'PUT', body: JSON.stringify(body) });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(kind: 'pdf' | 'geo_image', file: File) {
    if (!plazaId) {
      alert('Save the plaza first before uploading files.');
      return;
    }
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', file);
    const res = await fetch(`/api/plazas/${plazaId}/files`, { method: 'POST', body: fd });
    if (!res.ok) {
      alert((await res.text()) || 'Upload failed');
      return;
    }
    const refreshed = await api<PlazaDetail>(`/plazas/${plazaId}`);
    setFiles(refreshed.files);
  }

  async function deleteFile(fileId: number) {
    if (!plazaId) return;
    const res = await fetch(`/api/plazas/${plazaId}/files/${fileId}`, { method: 'DELETE' });
    if (!res.ok) return;
    setFiles(files.filter((f) => f.id !== fileId));
  }

  if (!filters) return <div className="p-8">Loading…</div>;

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setState({ ...state, [k]: e.target.value });

  return (
    <div className="min-h-full">
      <Header dataAsOf={null} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-heading text-2xl font-bold">
            {mode === 'new' ? 'Add toll plaza' : `Edit toll plaza #${plazaId ?? ''}`}
          </h1>
          <button onClick={() => nav(dashboardReturnUrl())} className="text-sm underline">Back to dashboard</button>
        </div>

        <FormSection title="Identification">
          <Field label="Toll Plaza Code"><input className={inputCls} value={state.plazaCode} onChange={set('plazaCode')} /></Field>
          <Field label="Name of Toll Plaza"><input className={inputCls} value={state.plazaName} onChange={set('plazaName')} /></Field>
          <Field label="Name of Road *" error={errors.roadName}><input className={inputCls} value={state.roadName} onChange={set('roadName')} /></Field>
          <Field label="SH/Bridges Name *" error={errors.shName}><input className={inputCls} value={state.shName} onChange={set('shName')} placeholder="e.g. SH-85 or Bridge" /></Field>
          <Field label="Division *" error={errors.divisionId}>
            <select className={inputCls} value={state.divisionId} onChange={set('divisionId')}>
              <option value="">Select…</option>
              {filters.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Village Name"><input className={inputCls} value={state.villageName} onChange={set('villageName')} /></Field>
          <Field label="Chainage (km+m)"><input className={inputCls} value={state.chainageRaw} onChange={set('chainageRaw')} placeholder="13+800" /></Field>
        </FormSection>

        <FormSection title="Location">
          <Field label="Latitude" error={errors.latitude}><input className={inputCls} value={state.latitude} onChange={set('latitude')} inputMode="decimal" /></Field>
          <Field label="Longitude" error={errors.longitude}><input className={inputCls} value={state.longitude} onChange={set('longitude')} inputMode="decimal" /></Field>
        </FormSection>

        <FormSection title="Lengths (km) — totals computed">
          <Field label="Road 2 Lane"><input className={inputCls} value={state.roadLen2laneKm} onChange={set('roadLen2laneKm')} inputMode="decimal" /></Field>
          <Field label="Road >=4 Lane"><input className={inputCls} value={state.roadLen4laneKm} onChange={set('roadLen4laneKm')} inputMode="decimal" /></Field>
          <Field label="Structure >60m 2 Lane"><input className={inputCls} value={state.structLen2laneKm} onChange={set('structLen2laneKm')} inputMode="decimal" /></Field>
          <Field label="Structure >60m >=4 Lane"><input className={inputCls} value={state.structLen4laneKm} onChange={set('structLen4laneKm')} inputMode="decimal" /></Field>
          <Readonly label="Total Road Length (km)" value={totals.roadTotal.toFixed(3)} />
          <Readonly label="Total Structure Length (km)" value={totals.structTotal.toFixed(3)} />
          <Readonly label="Total Length (km)" value={totals.total.toFixed(3)} />
          <Readonly label="Equivalent Length (km)" value={totals.equivalent.toFixed(3)} />
        </FormSection>

        <FormSection title="Plaza">
          <Field label="Type of Plaza">
            <select className={inputCls} value={state.plazaTypeRaw} onChange={set('plazaTypeRaw')}>
              <option value="">Not specified</option>
              {filters.plazaTypes
                .filter((t) => t.type !== 'Not specified')
                .map((t) => (
                  <option key={t.type} value={t.type}>{t.type}</option>
                ))}
            </select>
          </Field>
          <Field label="APC"><input className={inputCls} value={state.apc} onChange={set('apc')} inputMode="decimal" /></Field>
          <Field label="Location Finalized">
            <select className={inputCls} value={state.locationFinalized} onChange={set('locationFinalized')}>
              <option value="">Not updated</option>
              {filters.locationFinalizedOptions.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </Field>
        </FormSection>

        <FormSection title="Statuses">
          <StatusSelect label="Civil Work" value={state.civilStatusId} opts={filters.statusOptions.civil} onChange={set('civilStatusId')} />
          <StatusSelect label="Layout" value={state.layoutStatusId} opts={filters.statusOptions.layout} onChange={set('layoutStatusId')} />
          <StatusSelect label="System Integrator" value={state.siStatusId} opts={filters.statusOptions.system_integrator} onChange={set('siStatusId')} />
          <StatusSelect label="Toll Notification" value={state.notificationStatusId} opts={filters.statusOptions.toll_notification} onChange={set('notificationStatusId')} />
          <StatusSelect label="Toll Operator" value={state.operatorStatusId} opts={filters.statusOptions.toll_operator} onChange={set('operatorStatusId')} />
        </FormSection>

        <FormSection title="Attachments">
          {!plazaId && <div className="col-span-2 text-sm text-grey">Save the plaza first to enable attachments.</div>}
          {plazaId && (
            <>
              <FileUploader label="PDF document" accept="application/pdf" onFile={(f) => uploadFile('pdf', f)} />
              <FileUploader label="Geolocation image (JPG/PNG)" accept="image/jpeg,image/png" onFile={(f) => uploadFile('geo_image', f)} />
              <div className="col-span-2 space-y-1">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border border-bord rounded px-3 py-2">
                    <div className="truncate">
                      <span className="font-semibold">{f.kind === 'pdf' ? 'PDF' : 'Image'}:</span> {f.originalName}
                      <span className="ml-2 text-xs text-grey">{(f.sizeBytes / 1024).toFixed(0)} KB</span>
                      {f.exifLat && f.exifLong && (
                        <span className="ml-2 text-xs text-warn">EXIF: {f.exifLat}, {f.exifLong}</span>
                      )}
                    </div>
                    <button onClick={() => deleteFile(f.id)} className="text-bad text-sm font-semibold">Delete</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </FormSection>

        <div className="flex gap-2 justify-end mt-6">
          <button onClick={() => nav(dashboardReturnUrl())} className="px-4 py-2 border border-bord rounded">Cancel</button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="bg-accent text-white font-semibold px-5 py-2 rounded disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'new' ? 'Create plaza' : 'Save changes'}
          </button>
        </div>
      </main>
    </div>
  );
}

const inputCls = 'w-full border border-bord bg-card text-ink rounded px-3 py-2 outline-none focus:border-accent';

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-bord rounded-lg p-5 mb-4">
      <h2 className="font-heading font-semibold uppercase tracking-wide text-sm text-grey mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-grey mb-1">{label}</label>
      {children}
      {error && <div className="text-xs text-bad mt-1">{error}</div>}
    </div>
  );
}
function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-grey mb-1">{label}</label>
      <div className="num font-semibold px-3 py-2 bg-page border border-bord rounded">{value}</div>
    </div>
  );
}
function StatusSelect({
  label, value, opts, onChange,
}: {
  label: string;
  value: string;
  opts: Array<{ id: number; label: string }>;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={onChange}>
        <option value="">Not updated</option>
        {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </Field>
  );
}
function FileUploader({ label, accept, onFile }: { label: string; accept: string; onFile: (f: File) => void }) {
  return (
    <Field label={label}>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
        className="w-full text-sm"
      />
    </Field>
  );
}
