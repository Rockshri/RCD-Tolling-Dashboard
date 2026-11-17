import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const dlg = dlgRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      document.body.style.overflow = 'hidden';
      setCurrent(''); setNext(''); setConfirm(''); setError(null); setSuccess(false);
    } else if (!open && dlg.open) {
      dlg.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  function onBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dlgRef.current) onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setError('New password and confirmation do not match.'); return; }
    setBusy(true); setError(null);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Change failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dlgRef}
      aria-labelledby="change-pw-title"
      className="plaza-modal p-0 rounded-lg w-[min(460px,calc(100vw-32px))] max-w-none bg-card text-ink border border-bord backdrop:bg-black/50"
      onClose={onClose}
      onClick={onBackdropClick}
    >
      <form onSubmit={onSubmit} className="flex flex-col">
        <div className="sticky top-0 bg-header text-white px-5 py-4 flex items-center justify-between">
          <h2 id="change-pw-title" className="font-heading font-semibold text-lg">Change password</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          {success ? (
            <>
              <div className="text-sm text-good bg-good/10 border border-good/30 rounded px-3 py-2" role="status">
                Password updated. Future logins must use the new password.
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={onClose} className="bg-accent text-white px-4 py-2 rounded font-semibold">Done</button>
              </div>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-semibold text-grey">Current password *</span>
                <input autoFocus type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required
                  className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-grey">New password * (min 10 chars)</span>
                <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10}
                  className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-grey">Confirm new password *</span>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10}
                  className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
              </label>
              {error && <div className="text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2" role="alert">{error}</div>}
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={onClose} className="border border-bord px-4 py-2 rounded">Cancel</button>
                <button type="submit" disabled={busy || !current || next.length < 10 || !confirm} className="bg-accent text-white px-4 py-2 rounded font-semibold disabled:opacity-50">
                  {busy ? 'Saving…' : 'Change password'}
                </button>
              </div>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}
