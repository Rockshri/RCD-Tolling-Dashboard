import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';

async function main() {
  const q = async (s: string) => (await db.execute(sql.raw(s))).rows;
  console.log('status_options after migration:', await q('select field, label, tone, sort_order from status_options order by field, sort_order'));
  console.log('counts per label:', await q(`
    select so.field, so.label, count(tp.*)::int as n
    from status_options so
    left join toll_plazas tp on
      tp.civil_status_id = so.id or
      tp.layout_status_id = so.id or
      tp.si_status_id = so.id or
      tp.notification_status_id = so.id or
      tp.operator_status_id = so.id
    group by so.field, so.label
    order by so.field, so.label
  `));
  await pool.end();
}
main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
