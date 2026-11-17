import { Router } from 'express';
import { asc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { divisions, statusOptions, zones } from '../db/schema.js';
import { LOCATION_FINALIZED_OPTIONS } from '../lib/labels.js';

export const filtersRouter = Router();

filtersRouter.get('/filters', async (_req, res) => {
  const [z, d, s, t] = await Promise.all([
    db.select().from(zones).orderBy(asc(zones.id)),
    db.select().from(divisions).orderBy(asc(divisions.name)),
    db.select().from(statusOptions).orderBy(asc(statusOptions.field), asc(statusOptions.sortOrder)),
    // Distinct plaza types ordered by frequency (most used first). Blank/empty
    // values are surfaced as "Not specified" so the form dropdown can offer
    // an explicit "no type set" choice.
    db.execute(sql`
      select coalesce(nullif(plaza_type_raw, ''), 'Not specified') as type,
             count(*)::int as n
      from toll_plazas
      group by type
      order by n desc, type
    `),
  ]);

  const byField: Record<string, Array<{ id: number; label: string; tone: string }>> = {
    civil: [], layout: [], system_integrator: [], toll_notification: [], toll_operator: [],
  };
  for (const row of s) {
    byField[row.field]!.push({ id: row.id, label: row.label, tone: row.tone });
  }

  res.json({
    zones: z,
    divisions: d,
    statusOptions: byField,
    plazaTypes: t.rows as Array<{ type: string; n: number }>,
    locationFinalizedOptions: LOCATION_FINALIZED_OPTIONS,
  });
});
