import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { users } from '../db/schema.js';

async function main() {
  const target = process.argv[2] ?? 'admin';
  const [u] = await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, disabled: false })
    .where(eq(users.username, target))
    .returning();
  if (!u) console.error(`No user named ${target}`);
  else console.log(`Unlocked ${u.username} (role=${u.role}).`);
  await pool.end();
}
main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
