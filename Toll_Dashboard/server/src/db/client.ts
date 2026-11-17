import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

pool.on('error', (err) => {
  // An idle client dropped (ECONNRESET, server-side close, network blip).
  // The pool recovers; log and keep running so the process does not crash.
  console.error('[pg pool] idle client error:', err.message);
});

export const db = drizzle(pool, { schema });
