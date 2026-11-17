import { count, eq, sql } from 'drizzle-orm';
import { db } from './client.js';
import { buildWhere, Filters } from './filters.js';
import { statusOptions, tollPlazas } from './schema.js';

const cardColumns = {
  civil: tollPlazas.civilStatusId,
  layout: tollPlazas.layoutStatusId,
  system_integrator: tollPlazas.siStatusId,
  toll_notification: tollPlazas.notificationStatusId,
  toll_operator: tollPlazas.operatorStatusId,
} as const;

export type CardField = keyof typeof cardColumns;

export async function getCharts(filters: Filters) {
  const where = buildWhere(filters);
  // IMPORTANT: do NOT alias toll_plazas. buildWhere() emits "toll_plazas"."col"
  // references, so an alias here would make Postgres reject every filtered query.
  const typeMix = await db.execute(sql`
    select coalesce(nullif(toll_plazas.plaza_type_raw, ''), 'Not specified') as type,
           count(*)::int as n
    from toll_plazas
    ${where ? sql`where ${where}` : sql``}
    group by type
    order by n desc
  `);
  return {
    typeMix: typeMix.rows as Array<{ type: string; n: number }>,
  };
}

// Builds the full KPI aggregation. Factored out so we can call it once with the
// active filters (`kpis`) and once without (`totalKpis`) in getSummary().
function kpiSelect() {
  return db
    .select({
      plazas: count(),
      roadKm: sql<string>`coalesce(sum(${tollPlazas.roadLenTotalKm}), 0)::text`,
      structureKm: sql<string>`coalesce(sum(${tollPlazas.structLenTotalKm}), 0)::text`,
      divisions: sql<number>`count(distinct ${tollPlazas.divisionId})::int`,
      notFeasible: sql<number>`(count(*) filter (where ${statusOptions.tone} = 'not_feasible'))::int`,
      locationFinalized: sql<number>`(count(*) filter (where ${tollPlazas.locationFinalized} = 'Yes'))::int`,
      bsrdc: sql<number>`(count(*) filter (where ${tollPlazas.shName} ilike 'SH-%'))::int`,
      brpnnl: sql<number>`(count(*) filter (where lower(trim(${tollPlazas.shName})) = 'bridge'))::int`,
    })
    .from(tollPlazas)
    .leftJoin(statusOptions, eq(tollPlazas.civilStatusId, statusOptions.id));
}

type RawKpis = Awaited<ReturnType<typeof kpiSelect>>[number];
function toKpis(k: RawKpis | undefined) {
  return {
    plazas: Number(k?.plazas ?? 0),
    roadKm: Number(k?.roadKm ?? 0),
    structureKm: Number(k?.structureKm ?? 0),
    divisions: Number(k?.divisions ?? 0),
    notFeasible: Number(k?.notFeasible ?? 0),
    locationFinalized: Number(k?.locationFinalized ?? 0),
    bsrdc: Number(k?.bsrdc ?? 0),
    brpnnl: Number(k?.brpnnl ?? 0),
  };
}

export async function getSummary(filters: Filters) {
  const where = buildWhere(filters);

  // Filtered KPIs (respect every active filter) — power the lower strip.
  // Unfiltered KPIs (headline totals) — power the "Totals" strip shown above.
  //   - locationFinalized: plazas whose Location Finalized = 'Yes'.
  //   - bsrdc:  State-Highway entries (sh_name matches 'SH-...').
  //   - brpnnl: Bridge entries (sh_name = 'Bridge', case-insensitive).
  const [kpis] = await kpiSelect().where(where);
  const [totalKpisRow] = await kpiSelect();

  const cards = await Promise.all(
    (Object.entries(cardColumns) as [CardField, (typeof cardColumns)[CardField]][]).map(
      async ([field, col]) => ({
        field,
        rows: await db
          .select({ statusId: col, label: statusOptions.label, tone: statusOptions.tone, n: count() })
          .from(tollPlazas)
          .leftJoin(statusOptions, eq(col, statusOptions.id))
          .where(where)
          .groupBy(col, statusOptions.label, statusOptions.tone),
      }),
    ),
  );

  const [dataAsOf] = await db
    .select({ at: sql<string | null>`max(${tollPlazas.updatedAt})::text` })
    .from(tollPlazas);

  return {
    kpis: toKpis(kpis),
    totalKpis: toKpis(totalKpisRow),
    cards,
    dataAsOf: dataAsOf?.at ?? null,
  };
}
