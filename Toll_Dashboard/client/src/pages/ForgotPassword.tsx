import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-page flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="bg-card border border-bord rounded-lg shadow-sm w-full max-w-sm p-6">
        <h1 className="font-heading text-2xl font-bold text-ink">Forgot your password?</h1>
        <p className="text-sm text-grey mt-1 mb-6">
          Enter the email tied to your account. If it matches, we'll send a reset link.
        </p>

        {sent ? (
          <div className="text-sm text-good bg-good/10 border border-good/30 rounded px-3 py-2">
            If an account with that email exists, a reset link has been sent. The link is valid for 60 minutes.
          </div>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-semibold text-grey">Email</span>
              <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
            </label>
            {error && <div className="mt-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2" role="alert">{error}</div>}
            <button type="submit" disabled={busy || !email} className="mt-6 w-full bg-accent text-white font-semibold py-2 rounded disabled:opacity-50">
              {busy ? 'Sending…' : 'Send reset link'}
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
