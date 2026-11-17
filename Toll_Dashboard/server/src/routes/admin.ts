import { Router } from 'express';
import { z } from 'zod';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog, sessions, users } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';
import { requireRole } from '../lib/middleware.js';

export const adminRouter = Router();

const roleSchema = z.enum(['viewer', 'editor', 'admin']);

const emailSchema = z.string().trim().email().max(254).optional().or(z.literal('').transform(() => undefined));

const createSchema = z.object({
  username: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/, 'letters, digits, dot, underscore, hyphen'),
  email: emailSchema,
  password: z.string().min(10).max(200),
  role: roleSchema,
}).strict();

const patchSchema = z.object({
  email: emailSchema,
  role: roleSchema.optional(),
  disabled: z.boolean().optional(),
}).strict();

const adminResetSchema = z.object({
  newPassword: z.string().min(10).max(200),
}).strict();

adminRouter.get('/admin/users', requireRole('admin'), async (_req, res, next) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        disabled: users.disabled,
        mustChangePassword: users.mustChangePassword,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(asc(users.username));
    res.json({ users: rows });
  } catch (e) { next(e); }
});

adminRouter.post('/admin/users', requireRole('admin'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).limit(1);
    if (existing.length) { res.status(409).json({ error: 'Username already taken' }); return; }
    const hash = await hashPassword(data.password);
    const [row] = await db.insert(users).values({
      username: data.username,
      email: data.email ?? null,
      passwordHash: hash,
      role: data.role,
      mustChangePassword: true,
    }).returning({ id: users.id, username: users.username, email: users.email, role: users.role, disabled: users.disabled });
    await db.insert(auditLog).values({
      plazaId: null, field: 'user_create', oldValue: null, newValue: `${data.username} (${data.role})`, changedBy: req.user?.id ?? null,
    });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

adminRouter.patch('/admin/users/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid id' }); return; }
    const data = patchSchema.parse(req.body);

    const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!before) { res.status(404).json({ error: 'User not found' }); return; }

    // Guard: do not let an admin lock themselves out.
    if (req.user?.id === id && data.disabled === true) {
      res.status(400).json({ error: 'You cannot disable your own account.' });
      return;
    }
    if (req.user?.id === id && data.role !== undefined && data.role !== 'admin') {
      res.status(400).json({ error: 'You cannot change your own role.' });
      return;
    }

    const next: Record<string, unknown> = {};
    if (data.email !== undefined) next.email = data.email ?? null;
    if (data.role !== undefined) next.role = data.role;
    if (data.disabled !== undefined) next.disabled = data.disabled;
    if (Object.keys(next).length === 0) { res.json({ id, unchanged: true }); return; }

    const [updated] = await db.update(users).set(next).where(eq(users.id, id)).returning({
      id: users.id, username: users.username, email: users.email, role: users.role, disabled: users.disabled,
    });

    for (const [k, v] of Object.entries(next)) {
      const oldV = (before as Record<string, unknown>)[k];
      await db.insert(auditLog).values({
        plazaId: null,
        field: `user_${k}`,
        oldValue: oldV == null ? null : String(oldV),
        newValue: v == null ? null : String(v),
        changedBy: req.user?.id ?? null,
      });
    }

    // Disabling a user should also drop their active sessions.
    if (data.disabled === true) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    res.json(updated);
  } catch (e) { next(e); }
});

adminRouter.post('/admin/users/:id/reset-password', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Invalid id' }); return; }
    const { newPassword } = adminResetSchema.parse(req.body);
    const [target] = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, id)).limit(1);
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }
    const hash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: hash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, id));
    // Invalidate any live sessions for this user; they must re-log in with the new password.
    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.insert(auditLog).values({
      plazaId: null, field: 'user_admin_reset_password', oldValue: null, newValue: target.username, changedBy: req.user?.id ?? null,
    });
    res.status(204).end();
  } catch (e) { next(e); }
});
