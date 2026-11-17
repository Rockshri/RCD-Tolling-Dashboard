import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-page flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="bg-card border border-bord rounded-lg shadow-sm w-full max-w-sm p-6">
        <h1 className="font-heading text-2xl font-bold text-ink">Reset password</h1>

        {!token ? (
          <div className="mt-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2">
            No reset token in the link. Request a new reset email.
          </div>
        ) : done ? (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-good bg-good/10 border border-good/30 rounded px-3 py-2">
              Password updated. Sign in with the new password.
            </div>
            <button type="button" onClick={() => nav('/login')} className="w-full bg-accent text-white font-semibold py-2 rounded">
              Go to sign in
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-grey mt-1 mb-6">Enter your new password below.</p>
            <label className="block">
              <span className="text-xs font-semibold text-grey">New password * (min 10 chars)</span>
              <input autoFocus type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10}
                className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
            </label>
            <label className="block mt-3">
              <span className="text-xs font-semibold text-grey">Confirm new password *</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10}
                className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
            </label>
            {error && <div className="mt-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2" role="alert">{error}</div>}
            <button type="submit" disabled={busy || newPassword.length < 10 || !confirm}
              className="mt-6 w-full bg-accent text-white font-semibold py-2 rounded disabled:opacity-50">
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </>
        )}

        <div className="mt-4 text-sm text-center">
          <Link to="/login" className="text-accent underline">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
