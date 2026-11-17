import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, onUnauthorised, type Me } from './api';

type AuthCtx = {
  me: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api<{ user: Me }>('/auth/me');
      setMe(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const off = onUnauthorised(() => setMe(null));
    return () => { off(); };
  }, []);

  async function login(username: string, password: string) {
    const data = await api<{ user: Me }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setMe(data.user);
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setMe(null);
  }

  return <Ctx.Provider value={{ me, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
