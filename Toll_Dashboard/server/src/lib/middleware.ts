import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { loadSession, SESSION_COOKIE, type AuthedUser } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      requestId?: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.header('x-request-id') ?? nanoid(16)).slice(0, 36);
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return next();
  const u = await loadSession(sid);
  if (u) req.user = u;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
  next();
}

export function requireRole(...roles: Array<AuthedUser['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
    if (!roles.includes(req.user.role)) { res.status(403).json({ error: 'Forbidden' }); return; }
    next();
  };
}

export function authorize(action: 'read' | 'write' | 'admin', role: AuthedUser['role']): boolean {
  if (action === 'read') return role === 'viewer' || role === 'editor' || role === 'admin';
  if (action === 'write') return role === 'editor' || role === 'admin';
  return role === 'admin';
}
