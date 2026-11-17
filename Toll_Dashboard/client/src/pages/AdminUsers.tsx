import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dashboardReturnUrl } from '../lib/dashboardReturn';

type AdminUser = {
  id: number;
  username: string;
  email: string | null;
  role: 'viewer' | 'editor' | 'admin';
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export function AdminUsers() {
  const nav = useNavigate();
  const { me } = useAuth();
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);

  async function refresh() {
    const data = await api<{ users: AdminUser[] }>('/admin/users');
    setRows(data.users);
  }
  useEffect(() => { refresh(); }, []);

  if (!me) return null;
  if (me.role !== 'admin') {
    return (
      <div className="min-h-full">
        <Header dataAsOf={null} />
        <main className="max-w-xl mx-auto px-4 py-8">
          <div className="bg-card border border-bord rounded-lg p-6 text-center">
            <h1 className="font-heading text-xl font-bold text-ink">Forbidden</h1>
            <p className="text-grey mt-1">Only administrators can access user management.</p>
            <button onClick={() => nav('/')} className="mt-4 text-accent underline">Back to dashboard</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <Header dataAsOf={null} />
      <main className="max-w-[1100px] mx-auto px-4 lg:px-6 py-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-ink">Users</h1>
            <p className="text-sm text-grey">Manage who can access the dashboard.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => nav(dashboardReturnUrl())} className="border border-bord px-3 py-2 rounded font-semibold">Back to dashboard</button>
            <button onClick={() => setShowCreate(true)} className="bg-accent text-white px-4 py-2 rounded font-semibold">+ Add user</button>
          </div>
        </div>

        {rows == null ? (
          <div className="bg-card border border-bord rounded-lg p-8 text-grey">Loading…</div>
        ) : (
          <div className="bg-card border border-bord rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-header text-white">
                <tr>
                  <Th>Username</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Last login</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-bord">
                    <Td bold>{u.username}{u.id === me.id && <span className="ml-2 text-xs text-grey">(you)</span>}</Td>
                    <Td>{u.email || <span className="text-grey">—</span>}</Td>
                    <Td>
                      <RoleSelect
                        value={u.role}
                        disabled={u.id === me.id}
                        onChange={async (newRole) => {
                          await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
                          await refresh();
                        }}
                      />
                    </Td>
                    <Td>
                      {u.disabled
                        ? <span className="bg-bad text-white text-xs font-semibold px-2 py-1 rounded">Disabled</span>
                        : <span className="bg-good text-white text-xs font-semibold px-2 py-1 rounded">Active</span>}
                      {u.mustChangePassword && <span className="ml-2 text-xs text-warn">must change pw</span>}
                    </Td>
                    <Td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-IN') : <span className="text-grey">never</span>}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setResetTarget(u)}
                          className="text-sm underline text-accent"
                        >
                          Reset password
                        </button>
                        {u.id !== me.id && (
                          <button
                            onClick={async () => {
                              await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ disabled: !u.disabled }) });
                              await refresh();
                            }}
                            className="text-sm underline text-bad"
                          >
                            {u.disabled ? 'Enable' : 'Disable'}
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <CreateUserDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); refresh(); }}
      />
      <AdminResetDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={() => { setResetTarget(null); refresh(); }}
      />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-heading font-semibold text-xs uppercase tracking-wide">{children}</th>;
}
function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td className={`px-3 py-2 align-middle text-ink ${bold ? 'font-semibold' : ''}`}>{children}</td>;
}

function RoleSelect({ value, disabled, onChange }: {
  value: AdminUser['role'];
  disabled?: boolean;
  onChange: (r: AdminUser['role']) => void | Promise<void>;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      title={disabled ? "You cannot change your own role" : undefined}
      onChange={(e) => onChange(e.target.value as AdminUser['role'])}
      className="border border-bord bg-card text-ink rounded px-2 py-1 text-sm disabled:opacity-60"
    >
      <option value="viewer">viewer</option>
      <option value="editor">editor</option>
      <option value="admin">admin</option>
    </select>
  );
}

function CreateUserDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('viewer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setUsername(''); setEmail(''); setPassword(''); setRole('viewer'); setError(null); }
  }, [open]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username, email: email || undefined, password, role }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-bord rounded-lg w-[min(480px,calc(100vw-32px))] p-5 space-y-3"
      >
        <h2 className="font-heading font-bold text-lg">Add user</h2>
        <label className="block">
          <span className="text-xs font-semibold text-grey">Username *</span>
          <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} required minLength={2}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-grey">Email (for password reset)</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-grey">Initial password * (min 10 chars)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
          <span className="block text-xs text-grey mt-1">User is forced to change this on first login.</span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-grey">Role *</span>
          <select value={role} onChange={(e) => setRole(e.target.value as AdminUser['role'])}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2">
            <option value="viewer">viewer (read-only)</option>
            <option value="editor">editor (can add/edit plazas)</option>
            <option value="admin">admin (full access)</option>
          </select>
        </label>
        {error && <div className="text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="border border-bord px-4 py-2 rounded">Cancel</button>
          <button type="submit" disabled={busy || !username || password.length < 10} className="bg-accent text-white px-4 py-2 rounded font-semibold disabled:opacity-50">
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminResetDialog({ target, onClose, onDone }: {
  target: AdminUser | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setNewPassword(''); setError(null); }
  }, [target]);

  if (!target) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/users/${target.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-bord rounded-lg w-[min(480px,calc(100vw-32px))] p-5 space-y-3"
      >
        <h2 className="font-heading font-bold text-lg">Reset password for {target.username}</h2>
        <p className="text-sm text-grey">
          The user will be forced to change this password at next login. Any active sessions for this user will be signed out.
        </p>
        <label className="block">
          <span className="text-xs font-semibold text-grey">New password * (min 10 chars)</span>
          <input autoFocus type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={10}
            className="mt-1 w-full border border-bord bg-card text-ink rounded px-3 py-2" />
        </label>
        {error && <div className="text-sm text-bad bg-bad/10 border border-bad/30 rounded px-3 py-2">{error}</div>}
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" onClick={onClose} className="border border-bord px-4 py-2 rounded">Cancel</button>
          <button type="submit" disabled={busy || newPassword.length < 10} className="bg-accent text-white px-4 py-2 rounded font-semibold disabled:opacity-50">
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
        </div>
      </form>
    </div>
  );
}
