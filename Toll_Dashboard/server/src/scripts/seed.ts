import { db, pool } from '../db/client.js';
import { statusOptions, zones } from '../db/schema.js';

type StatusSeed = {
  field: 'civil' | 'layout' | 'system_integrator' | 'toll_notification' | 'toll_operator';
  label: string;
  tone: 'done' | 'progress' | 'pending' | 'not_feasible' | 'neutral';
  sortOrder: number;
};

const STATUS_SEED: StatusSeed[] = [
  { field: 'civil', label: 'Work started',        tone: 'progress',     sortOrder: 10 },
  { field: 'civil', label: 'Not Feasible',        tone: 'not_feasible', sortOrder: 20 },
  { field: 'civil', label: 'Yet to be Started',   tone: 'neutral',      sortOrder: 30 },

  { field: 'layout', label: 'Done',               tone: 'done',         sortOrder: 10 },
  { field: 'layout', label: 'In Process',         tone: 'progress',     sortOrder: 20 },
  { field: 'layout', label: 'Not Feasible',       tone: 'not_feasible', sortOrder: 30 },

  { field: 'system_integrator', label: 'RFP Floated',  tone: 'progress',     sortOrder: 10 },
  { field: 'system_integrator', label: 'Not Feasible', tone: 'not_feasible', sortOrder: 20 },

  { field: 'toll_notification', label: 'In Process',          tone: 'progress',     sortOrder: 10 },
  { field: 'toll_notification', label: 'Yet to be Processed', tone: 'neutral',      sortOrder: 20 },
  { field: 'toll_notification', label: 'Not Feasible',        tone: 'not_feasible', sortOrder: 30 },

  { field: 'toll_operator', label: 'RFP Floated',  tone: 'progress',     sortOrder: 10 },
  { field: 'toll_operator', label: 'Work started', tone: 'progress',     sortOrder: 20 },
  { field: 'toll_operator', label: 'Not Feasible', tone: 'not_feasible', sortOrder: 30 },
];

async function main() {
  console.log('Seeding zones...');
  await db
    .insert(zones)
    .values([
      { name: 'South Bihar Zone' },
      { name: 'Seemanchal Zone' },
      { name: 'North Bihar Zone' },
    ])
    .onConflictDoNothing();

  console.log('Seeding status_options...');
  await db.insert(statusOptions).values(STATUS_SEED).onConflictDoNothing();

  console.log('Seed complete.');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
