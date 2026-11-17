import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export function Login() {
  const { login, me } = useAuth();
  const nav = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) nav(location.state?.from ?? '/', { replace: true });
  }, [me, nav, location.state?.from]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
      nav(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-page flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-card border border-bord rounded-lg shadow-sm w-full max-w-sm p-6"
        aria-labelledby="login-title"
      >
        <h1 id="login-title" className="font-heading text-2xl font-bold text-ink">RCD Toll Plaza Monitor</h1>
        <p className="text-sm text-grey mt-1 mb-6">Sign in to continue</p>

        <label className="block">
          <span className="text-xs font-semibold text-grey">Username</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2 outline-none focus:border-accent"
            autoComplete="username"
            required
          />
        </label>
        <label className="block mt-4">
          <span className="text-xs font-semibold text-grey">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2 outline-none focus:border-accent"
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div className="mt-4 text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2" role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username || !password}
          className="mt-6 w-full bg-accent text-white font-semibold py-2 rounded disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="mt-4 text-sm text-center">
          <Link to="/forgot-password" className="text-accent underline">Forgot password?</Link>
        </div>
      </form>
    </div>
  );
}
