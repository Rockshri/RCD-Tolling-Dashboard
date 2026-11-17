import { Router } from 'express';
import { z } from 'zod';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog, divisions, plazaFiles, tollPlazas } from '../db/schema.js';
import { buildWhere } from '../db/filters.js';
import { parseFilters } from '../lib/parseFilters.js';
import { requireRole } from '../lib/middleware.js';
import { LOCATION_FINALIZED_OPTIONS } from '../lib/labels.js';

export const plazasRouter = Router();

const SORT_COLS = {
  plazaCode: tollPlazas.plazaCode,
  plazaName: tollPlazas.plazaName,
  roadName: tollPlazas.roadName,
  shName: tollPlazas.shName,
  chainage: tollPlazas.chainageM,
  apc: tollPlazas.apc,
  plazaType: tollPlazas.plazaTypeRaw,
  sNo: tollPlazas.sNo,
} as const;

const listQuery = z.object({
  sort: z.enum(Object.keys(SORT_COLS) as [keyof typeof SORT_COLS]).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  // Cap raised from 200 to 1000 (2026-11-04). Still bounded to defend against
  // a malicious client asking for everything (brief T11). Enough headroom for
  // this dataset (92 rows today) to grow well beyond one page without needing
  // pagination UI.
  pageSize: z.coerce.number().int().min(1).max(1000).optional(),
});

plazasRouter.get('/plazas', async (req, res, next) => {
  try {
    const filters = parseFilters(req.query);
    const { sort, dir, page = 1, pageSize = 50 } = listQuery.parse({
      sort: req.query.sort,
      dir: req.query.dir,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    const where = buildWhere(filters);

    const sortCol = sort ? SORT_COLS[sort] : tollPlazas.sNo;
    const orderBy = dir === 'desc' ? desc(sortCol) : asc(sortCol);

    const rows = await db
      .select({
        id: tollPlazas.id,
        sNo: tollPlazas.sNo,
        plazaCode: tollPlazas.plazaCode,
        plazaName: tollPlazas.plazaName,
        roadName: tollPlazas.roadName,
        shName: tollPlazas.shName,
        chainageRaw: tollPlazas.chainageRaw,
        apc: tollPlazas.apc,
        plazaTypeRaw: tollPlazas.plazaTypeRaw,
        locationFinalized: tollPlazas.locationFinalized,
        entryKind: tollPlazas.entryKind,
        divisionName: divisions.name,
        civilId: tollPlazas.civilStatusId,
        layoutId: tollPlazas.layoutStatusId,
        siId: tollPlazas.siStatusId,
        notificationId: tollPlazas.notificationStatusId,
        operatorId: tollPlazas.operatorStatusId,
      })
      .from(tollPlazas)
      .leftJoin(divisions, eq(tollPlazas.divisionId, divisions.id))
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [totalRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tollPlazas)
      .where(where);

    res.json({
      rows,
      total: totalRow?.n ?? 0,
      page,
      pageSize,
    });
  } catch (e) {
    next(e);
  }
});

plazasRouter.get('/plazas/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const [row] = await db
      .select({
        plaza: tollPlazas,
        divisionName: divisions.name,
      })
      .from(tollPlazas)
      .leftJoin(divisions, eq(tollPlazas.divisionId, divisions.id))
      .where(eq(tollPlazas.id, id))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const files = await db
      .select({
        id: plazaFiles.id,
        kind: plazaFiles.kind,
        originalName: plazaFiles.originalName,
        mimeType: plazaFiles.mimeType,
        sizeBytes: plazaFiles.sizeBytes,
        exifLat: plazaFiles.exifLat,
        exifLong: plazaFiles.exifLong,
        uploadedAt: plazaFiles.uploadedAt,
      })
      .from(plazaFiles)
      .where(eq(plazaFiles.plazaId, id));

    res.json({ ...row.plaza, divisionName: row.divisionName, files });
  } catch (e) {
    next(e);
  }
});

const plazaInput = z.object({
  plazaCode: z.string().max(100).nullish(),
  plazaName: z.string().max(255).nullish(),
  roadName: z.string().min(1).max(500),
  shName: z.string().min(1).max(100),
  divisionId: z.number().int().positive(),
  villageName: z.string().max(255).nullish(),
  chainageRaw: z.string().max(50).nullish(),
  latitude: z.number().min(24).max(28).nullish(),
  longitude: z.number().min(83).max(89).nullish(),
  roadLen2laneKm: z.number().min(0).nullish(),
  roadLen4laneKm: z.number().min(0).nullish(),
  structLen2laneKm: z.number().min(0).nullish(),
  structLen4laneKm: z.number().min(0).nullish(),
  apc: z.number().nullish(),
  plazaTypeRaw: z.string().max(255).nullish(),
  locationFinalized: z.enum(LOCATION_FINALIZED_OPTIONS).nullish(),
  civilStatusId: z.number().int().positive().nullish(),
  layoutStatusId: z.number().int().positive().nullish(),
  siStatusId: z.number().int().positive().nullish(),
  notificationStatusId: z.number().int().positive().nullish(),
  operatorStatusId: z.number().int().positive().nullish(),
});

function toStr(n: number | null | undefined): string | null {
  return n === null || n === undefined ? null : String(n);
}

function parseChainageMeters(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+)\+(\d+)$/);
  return m && m[1] && m[2] ? Number(m[1]) * 1000 + Number(m[2]) : null;
}

plazasRouter.post('/plazas', requireRole('editor', 'admin'), async (req, res, next) => {
  try {
    const data = plazaInput.parse(req.body);
    const [row] = await db
      .insert(tollPlazas)
      .values({
        plazaCode: data.plazaCode ?? null,
        plazaName: data.plazaName ?? null,
        roadName: data.roadName,
        shName: data.shName,
        divisionId: data.divisionId,
        villageName: data.villageName ?? null,
        chainageRaw: data.chainageRaw ?? null,
        chainageM: parseChainageMeters(data.chainageRaw ?? null),
        latitude: toStr(data.latitude ?? null),
        longitude: toStr(data.longitude ?? null),
        roadLen2laneKm: toStr(data.roadLen2laneKm ?? null),
        roadLen4laneKm: toStr(data.roadLen4laneKm ?? null),
        structLen2laneKm: toStr(data.structLen2laneKm ?? null),
        structLen4laneKm: toStr(data.structLen4laneKm ?? null),
        apc: toStr(data.apc ?? null),
        plazaTypeRaw: data.plazaTypeRaw ?? null,
        locationFinalized: data.locationFinalized ?? null,
        civilStatusId: data.civilStatusId ?? null,
        layoutStatusId: data.layoutStatusId ?? null,
        siStatusId: data.siStatusId ?? null,
        notificationStatusId: data.notificationStatusId ?? null,
        operatorStatusId: data.operatorStatusId ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

plazasRouter.put('/plazas/:id', requireRole('editor', 'admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const data = plazaInput.parse(req.body);
    const [before] = await db.select().from(tollPlazas).where(eq(tollPlazas.id, id)).limit(1);
    if (!before) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const newValues = {
      plazaCode: data.plazaCode ?? null,
      plazaName: data.plazaName ?? null,
      roadName: data.roadName,
      shName: data.shName,
      divisionId: data.divisionId,
      villageName: data.villageName ?? null,
      chainageRaw: data.chainageRaw ?? null,
      chainageM: parseChainageMeters(data.chainageRaw ?? null),
      latitude: toStr(data.latitude ?? null),
      longitude: toStr(data.longitude ?? null),
      roadLen2laneKm: toStr(data.roadLen2laneKm ?? null),
      roadLen4laneKm: toStr(data.roadLen4laneKm ?? null),
      structLen2laneKm: toStr(data.structLen2laneKm ?? null),
      structLen4laneKm: toStr(data.structLen4laneKm ?? null),
      apc: toStr(data.apc ?? null),
      plazaTypeRaw: data.plazaTypeRaw ?? null,
      locationFinalized: data.locationFinalized ?? null,
      civilStatusId: data.civilStatusId ?? null,
      layoutStatusId: data.layoutStatusId ?? null,
      siStatusId: data.siStatusId ?? null,
      notificationStatusId: data.notificationStatusId ?? null,
      operatorStatusId: data.operatorStatusId ?? null,
    };

    const diffRows: Array<typeof auditLog.$inferInsert> = [];
    for (const [k, v] of Object.entries(newValues)) {
      const old = (before as Record<string, unknown>)[k];
      const oldStr = old === null || old === undefined ? null : String(old);
      const newStr = v === null || v === undefined ? null : String(v);
      if (oldStr !== newStr) {
        diffRows.push({ plazaId: id, field: k, oldValue: oldStr, newValue: newStr, changedBy: req.user?.id ?? null });
      }
    }

    const [updated] = await db
      .update(tollPlazas)
      .set(newValues)
      .where(eq(tollPlazas.id, id))
      .returning();

    if (diffRows.length) {
      await db.insert(auditLog).values(diffRows);
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
});
