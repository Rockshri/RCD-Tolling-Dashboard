import { z } from 'zod';
import { LOCATION_FINALIZED_OPTIONS } from './labels.js';
import type { Filters, StatusFilter } from '../db/filters.js';

const statusParam = z
  .union([z.literal('none'), z.coerce.number().int().positive()])
  .optional();

const KNOWN_LIST_PARAMS = new Set(['sort', 'dir', 'page', 'pageSize']);

const locationFinalizedParam = z
  .union([z.literal('none'), z.enum(LOCATION_FINALIZED_OPTIONS)])
  .optional();

export const filtersSchema = z
  .object({
    zone: z.coerce.number().int().positive().optional(),
    division: z.coerce.number().int().positive().optional(),
    civil: statusParam,
    layout: statusParam,
    si: statusParam,
    notification: statusParam,
    operator: statusParam,
    locationFinalized: locationFinalizedParam,
    entryType: z.enum(['road', 'bridge']).optional(),
    q: z.string().min(1).max(200).optional(),
  })
  .strict();

export function parseFilters(query: unknown): Filters {
  const q = (query ?? {}) as Record<string, unknown>;
  const forSchema: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(q)) {
    if (KNOWN_LIST_PARAMS.has(k)) continue;
    if (v === undefined || v === null || v === '') continue;
    forSchema[k] = v;
  }
  const parsed = filtersSchema.parse(forSchema);
  const f: Filters = {};
  if (parsed.zone !== undefined) f.zone = parsed.zone;
  if (parsed.division !== undefined) f.division = parsed.division;
  if (parsed.civil !== undefined) f.civil = parsed.civil as StatusFilter;
  if (parsed.layout !== undefined) f.layout = parsed.layout as StatusFilter;
  if (parsed.si !== undefined) f.si = parsed.si as StatusFilter;
  if (parsed.notification !== undefined) f.notification = parsed.notification as StatusFilter;
  if (parsed.operator !== undefined) f.operator = parsed.operator as StatusFilter;
  if (parsed.locationFinalized !== undefined) f.locationFinalized = parsed.locationFinalized;
  if (parsed.entryType !== undefined) f.entryType = parsed.entryType;
  if (parsed.q !== undefined) f.q = parsed.q;
  return f;
}
