import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { divisions, tollPlazas } from '../db/schema.js';
import { buildWhere } from '../db/filters.js';
import { getCharts, getSummary } from '../db/summary.js';
import { parseFilters } from '../lib/parseFilters.js';

export const summaryRouter = Router();

summaryRouter.get('/summary', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const summary = await getSummary(filters);
    res.json(summary);
  } catch (e) {
    next(e);
  }
});

summaryRouter.get('/charts', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const charts = await getCharts(filters);
    res.json(charts);
  } catch (e) {
    next(e);
  }
});

// List plazas matching the current dashboard filters AND a specific plaza type.
// `type` is the raw plaza_type_raw value; empty string / 'none' matches NULL/''.
const typeQuery = z.object({ type: z.string().max(500) }).strict();
summaryRouter.get('/plazas-by-type', async (req, res, next) => {
  try {
    const typeParam = typeQuery.parse({ type: typeof req.query.type === 'string' ? req.query.type : '' }).type;
    const filterQuery: Record<string, unknown> = { ...req.query };
    delete filterQuery.type;
    const filters = parseFilters(filterQuery);
    const where = buildWhere(filters);

    const typeMatch = typeParam === '' || typeParam === 'Not specified'
      ? sql`(${tollPlazas.plazaTypeRaw} is null or ${tollPlazas.plazaTypeRaw} = '')`
      : eq(tollPlazas.plazaTypeRaw, typeParam);

    const rows = await db
      .select({
        id: tollPlazas.id,
        plazaCode: tollPlazas.plazaCode,
        roadName: tollPlazas.roadName,
        divisionName: divisions.name,
      })
      .from(tollPlazas)
      .leftJoin(divisions, eq(tollPlazas.divisionId, divisions.id))
      .where(where ? and(where, typeMatch) : typeMatch)
      .orderBy(asc(tollPlazas.roadName))
      .limit(500);

    res.json({ type: typeParam, rows });
  } catch (e) {
    next(e);
  }
});
