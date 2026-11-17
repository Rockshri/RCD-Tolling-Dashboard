import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { z } from 'zod';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog, passwordResets, sessions, users } from '../db/schema.js';
import {
  createSession, destroySession, hashPassword, SESSION_COOKIE, verifyPassword,
} from '../lib/auth.js';
import { requireAuth } from '../lib/middleware.js';
import { sendResetEmail } from '../lib/mailer.js';
import { logger } from '../lib/log.js';

export const authRouter = Router();

// Login rate limit and per-account lockout were removed on user request.
// Trade-off recorded in docs/threat-model.md (T1) and docs/adr/0006-no-login-rate-limit.md.

const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
}).strict();

const SECURE_COOKIE = process.env.NODE_ENV === 'production';

function cookieOpts(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: SECURE_COOKIE,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs,
  };
}

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    const genericErr = () => res.status(401).json({ error: 'Invalid username or password' });

    if (!u) {
      await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$aaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', password);
      return genericErr();
    }
    if (u.disabled) return genericErr();

    const ok = await verifyPassword(u.passwordHash, password);
    if (!ok) {
      // Rate limit + lockout removed on user request. Still audit every failed attempt.
      await db.insert(auditLog).values({
        plazaId: null, field: 'login_failed', oldValue: null, newValue: username, changedBy: u.id,
      });
      return genericErr();
    }

    const sid = await createSession(u.id, req.ip ?? null, req.get('user-agent') ?? null);
    await db.update(users).set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    }).where(eq(users.id, u.id));
    await db.insert(auditLog).values({
      plazaId: null, field: 'login_ok', oldValue: null, newValue: username, changedBy: u.id,
    });

    res.cookie(SESSION_COOKIE, sid, cookieOpts(12 * 60 * 60 * 1000));
    res.json({ user: { id: u.id, username: u.username, role: u.role, mustChangePassword: u.mustChangePassword } });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/auth/logout', async (req, res, next) => {
  try {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) await destroySession(sid);
    res.clearCookie(SESSION_COOKIE, cookieOpts(0));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

authRouter.get('/auth/me', (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Not authenticated' }); return; }
  res.json({ user: req.user });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10).max(200),
}).strict();

authRouter.post('/auth/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!u) { res.status(401).json({ error: 'Not authenticated' }); return; }
    const ok = await verifyPassword(u.passwordHash, currentPassword);
    if (!ok) { res.status(400).json({ error: 'Current password incorrect' }); return; }
    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash, mustChangePassword: false }).where(eq(users.id, u.id));
    await db.insert(auditLog).values({
      plazaId: null, field: 'self_change_password', oldValue: null, newValue: u.username, changedBy: u.id,
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Forgot password — public, rate-limited. Always responds 204 so an attacker
// cannot enumerate which emails have an account.
const forgotLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
const forgotSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();
const RESET_TTL_MIN = 60;

function hashToken(t: string): string {
  return crypto.createHash('sha256').update(t).digest('hex');
}

authRouter.post('/auth/forgot-password', forgotLimit, async (req, res, next) => {
  try {
    const { email } = forgotSchema.parse(req.body);
    const [u] = await db.select().from(users)
      .where(and(sql`lower(${users.email}) = lower(${email})`, eq(users.disabled, false)))
      .limit(1);
    if (u) {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);
      await db.insert(passwordResets).values({ userId: u.id, tokenHash, expiresAt });
      const base = process.env.CLIENT_ORIGIN?.split(',')[0] ?? 'http://localhost:5173';
      const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
      await sendResetEmail({ to: email, username: u.username, resetUrl, expiresMinutes: RESET_TTL_MIN });
      await db.insert(auditLog).values({
        plazaId: null, field: 'forgot_password_request', oldValue: null, newValue: u.username, changedBy: u.id,
      });
    } else {
      // Log but don't tell the caller. Helps detect probing in audit_log.
      logger.info({ email }, '[auth] forgot-password: no match (silent)');
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

const resetSchema = z.object({
  token: z.string().min(10).max(500),
  newPassword: z.string().min(10).max(200),
}).strict();

authRouter.post('/auth/reset-password', forgotLimit, async (req, res, next) => {
  try {
    const { token, newPassword } = resetSchema.parse(req.body);
    const tokenHash = hashToken(token);
    const [row] = await db
      .select({ pr: passwordResets, u: users })
      .from(passwordResets)
      .innerJoin(users, eq(passwordResets.userId, users.id))
      .where(and(
        eq(passwordResets.tokenHash, tokenHash),
        gt(passwordResets.expiresAt, new Date()),
        isNull(passwordResets.usedAt),
      ))
      .limit(1);
    if (!row) {
      res.status(400).json({ error: 'Reset link is invalid or has expired.' });
      return;
    }
    if (row.u.disabled) {
      res.status(400).json({ error: 'This account is disabled.' });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await db.update(users)
      .set({ passwordHash: newHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, row.u.id));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, row.pr.id));
    // Invalidate any live sessions — the user must log in again with the new password.
    await db.delete(sessions).where(eq(sessions.userId, row.u.id));
    await db.insert(auditLog).values({
      plazaId: null, field: 'password_reset_completed', oldValue: null, newValue: row.u.username, changedBy: row.u.id,
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
