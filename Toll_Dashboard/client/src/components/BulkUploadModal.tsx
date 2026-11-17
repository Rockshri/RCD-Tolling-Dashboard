import { useEffect, useRef, useState } from 'react';

type Issue = { sheetRow: number; field: string; raw: string; reason: string };
type UploadResult = { imported: number; skipped: number; issues: Issue[]; sheet: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
};

export function BulkUploadModal({ open, onClose, onImported }: Props) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      document.body.style.overflow = 'hidden';
      setResult(null);
      setError(null);
    } else if (!open && dlg.open) {
      dlg.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function doUpload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/plazas/bulk-upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = res.statusText;
        try { msg = (await res.json()).error ?? msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const data = (await res.json()) as UploadResult;
      setResult(data);
      if (data.imported > 0) onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dlgRef.current) onClose();
  }

  return (
    <dialog
      ref={dlgRef}
      aria-labelledby="upload-modal-title"
      className="plaza-modal p-0 rounded-lg w-[min(560px,calc(100vw-32px))] max-h-[85vh] max-w-none bg-card text-ink border border-bord backdrop:bg-black/50"
      onClose={onClose}
      onClick={onBackdropClick}
    >
      <div className="flex flex-col max-h-[85vh]">
        <div className="sticky top-0 bg-header text-white px-5 py-4 flex items-center justify-between">
          <h2 id="upload-modal-title" className="font-heading font-semibold text-lg">
            Upload Excel
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-sm text-grey space-y-1.5">
            <p>Upload an <span className="font-semibold text-ink">.xlsx</span> workbook with a sheet named <span className="font-mono text-ink">Details of Toll</span>.</p>
            <p>Rows are <span className="font-semibold">appended</span> — nothing existing is deleted or edited. Invalid rows are skipped and reported below. Max file size: 10 MB.</p>
            <p>Expected columns (A–X): S.No, Toll Plaza Code, Village Name, Chainage, Latitude, Longitude, Name of Road, SH Name, Division, lengths (J–N), APC, Type of Plaza, five statuses.</p>
          </div>

          <a
            href="/api/plazas/bulk-upload/template"
            download
            className="inline-flex items-center gap-2 border border-bord text-ink font-semibold text-sm px-3 py-2 rounded hover:bg-page"
          >
            <span aria-hidden>⬇</span>
            Download template
          </a>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doUpload(f);
              e.target.value = '';
            }}
            disabled={busy}
            className="block w-full text-sm text-ink file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-accent file:text-white file:font-semibold hover:file:brightness-110 disabled:opacity-50"
          />

          {busy && <div className="text-sm text-grey">Uploading and importing…</div>}
          {error && (
            <div className="text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2" role="alert">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <Stat label="Imported" value={result.imported} tone="good" />
                <Stat label="Skipped" value={result.skipped} tone={result.skipped > 0 ? 'warn' : 'grey'} />
              </div>
              {result.issues.length > 0 && (
                <div className="border border-bord rounded">
                  <div className="bg-page px-3 py-2 text-xs font-semibold uppercase tracking-wide text-grey border-b border-bord">
                    Skipped rows ({result.issues.length})
                  </div>
                  <ul className="max-h-64 overflow-y-auto divide-y divide-bord">
                    {result.issues.map((i, idx) => (
                      <li key={idx} className="px-3 py-2 text-sm">
                        <span className="num font-semibold">row {i.sheetRow}</span>
                        <span className="text-grey"> · {i.field}</span>
                        {i.raw && <span className="font-mono text-xs text-grey"> · "{i.raw.slice(0, 40)}"</span>}
                        <div className="text-grey">{i.reason}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-xs text-grey">Dashboard numbers refresh automatically.</div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-bord px-5 py-3 flex gap-2 justify-end">
          <button onClick={onClose} className="border border-bord text-ink font-semibold px-4 py-2 rounded">
            {result ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'good' | 'warn' | 'grey' }) {
  const colour = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : 'text-grey';
  return (
    <div className="flex-1 bg-page border border-bord rounded p-3">
      <div className="text-xs text-grey uppercase tracking-wide">{label}</div>
      <div className={`num text-2xl font-bold ${colour}`}>{value}</div>
    </div>
  );
}
