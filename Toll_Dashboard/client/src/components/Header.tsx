import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ChangePasswordModal } from './ChangePasswordModal';

export function Header({
  dataAsOf, showAdd, onUploadClick,
}: {
  dataAsOf: string | null;
  showAdd?: boolean;
  onUploadClick?: () => void;
}) {
  const nav = useNavigate();
  const { me, logout } = useAuth();
  const [dark, setDark] = useState<boolean>(() => localStorage.getItem('theme') === 'dark');
  const [menuOpen, setMenuOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const setVar = () => {
      document.documentElement.style.setProperty('--app-header-height', `${el.offsetHeight}px`);
    };
    setVar();
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    window.addEventListener('resize', setVar);
    return () => { ro.disconnect(); window.removeEventListener('resize', setVar); };
  }, []);

  // Show both date and time (hours+minutes, 12-hour, user's locale) so operators
  // can tell how fresh the dashboard is at a glance.
  const formatted = dataAsOf
    ? new Date(dataAsOf).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '—';

  const canWrite = me?.role === 'editor' || me?.role === 'admin';

  return (
    <header ref={ref} className="bg-header text-white sticky top-0 z-20">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold leading-tight tracking-tight">
            RCD Toll Plaza Monitor
          </h1>
          <p className="text-sm text-white/80 mt-0.5">Road Construction Department, Bihar</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <div className="text-white/70">Data as of</div>
            <div className="font-heading font-semibold num">{formatted}</div>
          </div>
          {showAdd && canWrite && onUploadClick && (
            <button
              onClick={onUploadClick}
              className="border border-white/30 hover:bg-white/10 text-white font-semibold px-4 py-2 rounded text-sm"
              title="Append rows from an .xlsx workbook"
            >
              Upload Excel
            </button>
          )}
          {showAdd && canWrite && (
            <button
              onClick={() => nav('/plazas/new')}
              className="bg-accent hover:brightness-110 text-white font-semibold px-4 py-2 rounded shadow-sm"
            >
              + Add toll plaza
            </button>
          )}
          <button
            onClick={() => setDark(!dark)}
            className="border border-white/30 hover:bg-white/10 text-white px-3 py-2 rounded text-sm"
            aria-label="Toggle theme"
          >
            {dark ? 'Light' : 'Dark'}
          </button>
          {me && (
            <div className="relative flex items-center gap-2 pl-2 border-l border-white/20">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="text-right text-sm px-2 py-1 rounded hover:bg-white/10"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <div className="font-semibold">{me.username} ▾</div>
                <div className="text-white/70 text-xs capitalize">{me.role}</div>
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-56 bg-card text-ink border border-bord rounded shadow-lg py-1 z-30"
                  role="menu"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => { setMenuOpen(false); setChangePwOpen(true); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-page"
                  >
                    Change my password
                  </button>
                  {me.role === 'admin' && (
                    <button
                      onClick={() => { setMenuOpen(false); nav('/admin/users'); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-page"
                    >
                      Manage users
                    </button>
                  )}
                  <div className="border-t border-bord my-1" />
                  <button
                    onClick={async () => { setMenuOpen(false); await logout(); nav('/login'); }}
                    className="w-full text-left px-3 py-2 text-sm text-bad hover:bg-page"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </header>
  );
}
