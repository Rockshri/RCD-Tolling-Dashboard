import { and, eq, ilike, inArray, isNull, or, SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from './client.js';
import { divisions, tollPlazas } from './schema.js';

export type StatusFilter = number | 'none';

export type Filters = {
  zone?: number;
  division?: number;
  civil?: StatusFilter;
  layout?: StatusFilter;
  si?: StatusFilter;
  notification?: StatusFilter;
  operator?: StatusFilter;
  locationFinalized?: string | 'none';
  entryType?: 'road' | 'bridge';
  q?: string;
};

const status = (col: AnyPgColumn, v?: StatusFilter): SQL | undefined =>
  v === undefined ? undefined : v === 'none' ? isNull(col) : eq(col, v);

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function buildWhere(f: Filters): SQL | undefined {
  const q = f.q?.trim();
  return and(
    f.zone !== undefined
      ? inArray(
          tollPlazas.divisionId,
          db.select({ id: divisions.id }).from(divisions).where(eq(divisions.zoneId, f.zone)),
        )
      : undefined,
    f.division !== undefined ? eq(tollPlazas.divisionId, f.division) : undefined,
    status(tollPlazas.civilStatusId, f.civil),
    status(tollPlazas.layoutStatusId, f.layout),
    status(tollPlazas.siStatusId, f.si),
    status(tollPlazas.notificationStatusId, f.notification),
    status(tollPlazas.operatorStatusId, f.operator),
    f.locationFinalized === undefined
      ? undefined
      : f.locationFinalized === 'none'
        ? isNull(tollPlazas.locationFinalized)
        : eq(tollPlazas.locationFinalized, f.locationFinalized),
    f.entryType !== undefined ? eq(tollPlazas.entryKind, f.entryType) : undefined,
    q
      ? or(
          ilike(tollPlazas.roadName, `%${escapeLike(q)}%`),
          ilike(tollPlazas.plazaName, `%${escapeLike(q)}%`),
          ilike(tollPlazas.plazaCode, `%${escapeLike(q)}%`),
          ilike(tollPlazas.shName, `%${escapeLike(q)}%`),
        )
      : undefined,
  );
}
