import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../lib/auth.js';

async function main() {
  const [, , usernameArg, passwordArg, roleArg] = process.argv;
  const username = usernameArg ?? 'admin';
  const password = passwordArg ?? 'change-me-now';
  const role = (roleArg as 'viewer' | 'editor' | 'admin') ?? 'admin';

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const hash = await hashPassword(password);
  if (existing[0]) {
    await db.update(users).set({ passwordHash: hash, role, disabled: false, mustChangePassword: true }).where(eq(users.id, existing[0].id));
    console.log(`Updated user ${username} (role=${role}). Must change password on next login.`);
  } else {
    await db.insert(users).values({ username, passwordHash: hash, role, mustChangePassword: true });
    console.log(`Created user ${username} (role=${role}). Must change password on next login.`);
  }
  await pool.end();
}

main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
