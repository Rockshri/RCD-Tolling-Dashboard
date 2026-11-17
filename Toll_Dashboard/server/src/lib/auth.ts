import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify, Algorithm } from '@node-rs/argon2';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'rcd_sid';

const ARGON2_OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try { return await argon2Verify(hashStr, plain); } catch { return false; }
}

export function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export type AuthedUser = {
  id: number;
  username: string;
  role: 'viewer' | 'editor' | 'admin';
  mustChangePassword: boolean;
};

export async function createSession(userId: number, ip: string | null, userAgent: string | null): Promise<string> {
  const id = newSessionId();
  const now = new Date();
  await db.insert(sessions).values({
    id,
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + ABSOLUTE_MS),
    ip,
    userAgent,
  });
  return id;
}

export async function destroySession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function loadSession(id: string): Promise<AuthedUser | null> {
  const now = new Date();
  const [row] = await db
    .select({
      s: sessions,
      u: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  if (row.u.disabled) return null;

  const idleCutoff = new Date(now.getTime() - IDLE_MS);
  if (row.s.lastSeenAt < idleCutoff) {
    await destroySession(id);
    return null;
  }
  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
  return {
    id: row.u.id,
    username: row.u.username,
    role: row.u.role,
    mustChangePassword: row.u.mustChangePassword,
  };
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
