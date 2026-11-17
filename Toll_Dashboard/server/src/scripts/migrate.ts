import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../db/client.js';

async function main() {
  await migrate(db, { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('Migrations applied.');
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
