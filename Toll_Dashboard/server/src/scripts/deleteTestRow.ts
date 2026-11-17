import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { tollPlazas } from '../db/schema.js';

async function main() {
  const deleted = await db.delete(tollPlazas).where(eq(tollPlazas.roadName, 'Test Road')).returning();
  console.log(`Deleted ${deleted.length} test rows.`);
  await pool.end();
}
main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
