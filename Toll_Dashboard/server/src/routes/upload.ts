import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  divisionAliases, divisions, importLog, statusOptions, tollPlazas,
} from '../db/schema.js';
import { requireAuth, requireRole } from '../lib/middleware.js';
import { LOCATION_FINALIZED_OPTIONS } from '../lib/labels.js';

export const uploadRouter = Router();

const SHEET_NAME = 'Details of Toll';
const MAX_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

// ──────────────────────────────────────────────────────────────────────────
// Column mapping is header-name based. The bulk-upload reads the first row
// of the sheet and resolves each logical field to the column index whose
// header text matches one of the accepted synonyms. This way, both the
// current 25-column template (with Location Finalized) and older 24-column
// workbooks work without the uploader having to be re-aligned by position.
// ──────────────────────────────────────────────────────────────────────────

const FIELD_SYNONYMS = {
  sNo:            ['S.No', 'S. No', 'Sr. No', 'Serial No'],
  plazaCode:      ['Toll Plaza Code', 'Plaza Code'],
  villageName:    ['Village Name'],
  chainage:       ['Chainage', 'Chainage of Toll Plaza', 'Chanainage of Toll Plaza'],
  latitude:       ['Latitude'],
  longitude:      ['Longitude'],
  roadName:       ['Name of Road'],
  shName:         ['SH Name', 'SH/Bridges Name', 'SH Name / Bridge Name'],
  division:       ['Division'],
  roadLen2lane:   ['Length of Road 2 Lane (without Str)', 'Road 2 Lane', 'Road 2 Lane (km)'],
  roadLen4lane:   ['Length of Road >=4 Lane (without Str)', 'Road >=4 Lane', 'Road 4 Lane'],
  structLen2lane: ['Structure >60 m (2 lane)', 'Structure 2 Lane'],
  structLen4lane: ['Structure >60 m (>=4 lane)', 'Structure 4 Lane'],
  apc:            ['APC'],
  plazaType:      ['Type of Plaza'],
  locationFinalized: ['Location Finalized', 'Location Finalised'],
  civil:          ['Status of Civil Work', 'Civil Work', 'Civil'],
  layout:         ['Status of Layout', 'Layout'],
  si:             ['Status of System Integrator', 'System Integrator', 'SI'],
  notification:   ['Status of Toll Notification', 'Toll Notification', 'Notification'],
  operator:       ['Name of Toll Operator', 'Toll Operator', 'Operator'],
} as const;

type FieldKey = keyof typeof FIELD_SYNONYMS;
type ColMap = Partial<Record<FieldKey, number>>;

function normaliseHeader(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function resolveColMap(headerRow: ExcelJS.Row): ColMap {
  const headerByCol: Record<number, string> = {};
  headerRow.eachCell((cell, colNumber) => {
    headerByCol[colNumber] = normaliseHeader(cellString(cell));
  });
  const map: ColMap = {};
  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS) as [FieldKey, readonly string[]][]) {
    const wanted = synonyms.map(normaliseHeader);
    const found = Object.entries(headerByCol).find(([, header]) => wanted.includes(header));
    if (found) map[field] = Number(found[0]);
  }
  return map;
}

type UploadIssue = { sheetRow: number; field: string; raw: string; reason: string };

function cellString(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const o = v as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> };
    if (o.result != null) {
      if (typeof o.result === 'string' || typeof o.result === 'number') return String(o.result).trim();
      if (o.result instanceof Date) return o.result.toISOString();
    }
    if (typeof o.text === 'string') return o.text.trim();
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join('').trim();
  }
  return '';
}

function parseKm(s: string): string | null {
  if (!s) return null;
  const n = Number(s.trim());
  return Number.isFinite(n) ? String(n) : null;
}

function parseChainage(s: string): { raw: string | null; meters: number | null } {
  const t = s.trim();
  if (!t) return { raw: null, meters: null };
  if (/^cancelled$/i.test(t)) return { raw: t, meters: null };
  const m = t.match(/^(\d+)\+(\d+)$/);
  if (m && m[1] && m[2]) return { raw: t, meters: Number(m[1]) * 1000 + Number(m[2]) };
  return { raw: t, meters: null };
}

function parseCoord(s: string): { v: string | null; review: boolean } {
  const t = s.trim();
  if (!t) return { v: null, review: true };
  if (/[a-z]/i.test(t)) return { v: null, review: true };
  const n = Number(t);
  if (!Number.isFinite(n)) return { v: null, review: true };
  return { v: String(n), review: false };
}

function titleCase(s: string): string {
  return s.toLowerCase().split(/(\s+|-)/)
    .map((t) => (/^\s+$|^-$/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1)))
    .join('').trim();
}

async function resolveDivision(raw: string): Promise<number | null> {
  const r = raw.trim();
  if (!r) return null;
  const [alias] = await db.select({ id: divisionAliases.divisionId })
    .from(divisionAliases).where(eq(divisionAliases.rawName, r)).limit(1);
  if (alias) return alias.id;
  const canonical = titleCase(r);
  let [division] = await db.select().from(divisions).where(eq(divisions.name, canonical)).limit(1);
  if (!division) {
    [division] = await db.insert(divisions).values({ name: canonical }).returning();
  }
  await db.insert(divisionAliases).values({ rawName: r, divisionId: division!.id }).onConflictDoNothing();
  return division!.id;
}

async function resolveStatus(
  field: 'civil' | 'layout' | 'system_integrator' | 'toll_notification' | 'toll_operator',
  raw: string,
): Promise<{ id: number | null; relabel?: string }> {
  let v = raw.trim();
  if (!v) return { id: null };
  let relabel: string | undefined;
  if (/^cancelled$/i.test(v)) { v = 'Not Feasible'; relabel = 'Cancelled -> Not Feasible'; }
  if (/^in[\s-]process$/i.test(v)) { v = 'In Process'; if (raw !== 'In Process') relabel = `${raw} -> In Process`; }
  if (/^work\s+not\s+started$/i.test(v) && field === 'civil') {
    v = 'Yet to be Started';
    relabel = 'Work not started -> Yet to be Started';
  }
  const [opt] = await db.select().from(statusOptions)
    .where(and(eq(statusOptions.field, field), eq(statusOptions.label, v))).limit(1);
  if (!opt) return { id: null };
  return { id: opt.id, relabel };
}

function locationFinalizedFromCell(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const match = LOCATION_FINALIZED_OPTIONS.find((o) => o.toLowerCase() === t.toLowerCase());
  return match ?? null;
}

// ──────────────────────────────────────────────────────────────────────────
// Template layout (25 columns, A..Y). Location Finalized sits immediately
// before the Status columns, which shift right by one.
// ──────────────────────────────────────────────────────────────────────────
type TemplateColumn = {
  header: string;
  width: number;
  statusField?: 'civil' | 'layout' | 'system_integrator' | 'toll_notification' | 'toll_operator' | 'location_finalized';
};

const TEMPLATE_COLUMNS: TemplateColumn[] = [
  { header: 'S.No', width: 6 },
  { header: 'Toll Plaza Code', width: 16 },
  { header: 'Village Name', width: 18 },
  { header: 'Chainage', width: 12 },
  { header: 'Latitude', width: 11 },
  { header: 'Longitude', width: 11 },
  { header: 'Name of Road', width: 32 },
  { header: 'SH/Bridges Name', width: 14 },
  { header: 'Division', width: 16 },
  { header: 'Length of Road 2 Lane (without Str)', width: 18 },
  { header: 'Length of Road >=4 Lane (without Str)', width: 20 },
  { header: 'Total Road Length (Km)', width: 16 },
  { header: 'Structure >60 m (2 lane)', width: 16 },
  { header: 'Structure >60 m (>=4 lane)', width: 18 },
  { header: 'Total Structure Length', width: 18 },
  { header: 'Total Length', width: 14 },
  { header: 'Equivalent Length', width: 16 },
  { header: 'APC', width: 10 },
  { header: 'Type of Plaza', width: 28 },
  { header: 'Location Finalized', width: 20, statusField: 'location_finalized' },
  { header: 'Status of Civil Work', width: 20, statusField: 'civil' },
  { header: 'Status of Layout', width: 18, statusField: 'layout' },
  { header: 'Status of System Integrator', width: 22, statusField: 'system_integrator' },
  { header: 'Status of Toll Notification', width: 22, statusField: 'toll_notification' },
  { header: 'Name of Toll Operator', width: 22, statusField: 'toll_operator' },
];

// Excel's `formulae: ['"a,b,c"']` list-validation form has a ~255-char limit.
// All of our option sets are well under that, so inlining is safe.
function dropdownFormula(options: readonly string[]): string {
  const joined = options.join(',');
  return `"${joined.replace(/"/g, '""')}"`;
}

uploadRouter.get('/plazas/bulk-upload/template', requireAuth, async (_req, res, next) => {
  try {
    // Pull the current allowed labels for the five status fields out of the DB
    // so the dropdowns stay in sync with any vocabulary change.
    const options = await db.select().from(statusOptions).orderBy(asc(statusOptions.field), asc(statusOptions.sortOrder));
    const byField: Record<string, string[]> = {
      civil: [], layout: [], system_integrator: [], toll_notification: [], toll_operator: [],
    };
    for (const o of options) byField[o.field]!.push(o.label);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'RCD Toll Plaza Monitor';
    wb.created = new Date();
    const ws = wb.addWorksheet(SHEET_NAME);

    const header = ws.addRow(TEMPLATE_COLUMNS.map((c) => c.header));
    header.font = { bold: true };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 32;
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083E42' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });
    ws.columns = TEMPLATE_COLUMNS.map((c) => ({ width: c.width }));
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Apply list-validation (dropdown) to every row of each constrained column,
    // for rows 2..1001. Enough headroom; existing data rows get the dropdown too.
    const DATA_ROW_START = 2;
    const DATA_ROW_END = 1001;
    TEMPLATE_COLUMNS.forEach((col, idx) => {
      if (!col.statusField) return;
      const columnIndex = idx + 1; // 1-based
      const allowed =
        col.statusField === 'location_finalized' ? [...LOCATION_FINALIZED_OPTIONS] : byField[col.statusField] ?? [];
      if (allowed.length === 0) return;
      const formula = dropdownFormula(allowed);
      for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
        ws.getCell(r, columnIndex).dataValidation = {
          type: 'list',
          allowBlank: true,
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Unknown value',
          error: `Expected one of: ${allowed.join(', ')}`,
          formulae: [formula],
        };
      }
    });

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rcd-toll-upload-template.xlsx"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
});

uploadRouter.post('/plazas/bulk-upload', requireRole('editor', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'file field required' }); return; }

    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(req.file.buffer as unknown as ArrayBuffer);
    } catch {
      res.status(400).json({ error: 'Could not read file as an .xlsx workbook' });
      return;
    }

    const sheet = wb.getWorksheet(SHEET_NAME);
    if (!sheet) {
      res.status(400).json({ error: `Sheet "${SHEET_NAME}" not found. Available sheets: ${wb.worksheets.map((s) => s.name).join(', ')}` });
      return;
    }

    const COL = resolveColMap(sheet.getRow(1));
    if (COL.roadName === undefined) {
      res.status(400).json({ error: `Header row must contain "Name of Road" (required column).` });
      return;
    }
    const get = (row: ExcelJS.Row, f: FieldKey): string =>
      COL[f] === undefined ? '' : cellString(row.getCell(COL[f]!));

    const issues: UploadIssue[] = [];
    let imported = 0;
    const logEntries: Array<typeof importLog.$inferInsert> = [];

    const lastRow = sheet.actualRowCount;
    for (let r = 2; r <= lastRow; r++) {
      const row = sheet.getRow(r);
      if (!row.hasValues) continue;

      const sNoStr = get(row, 'sNo');
      const sNo = sNoStr === '' ? null : Number(sNoStr);
      const roadName = get(row, 'roadName');
      if (!roadName) {
        issues.push({ sheetRow: r, field: 'name_of_road', raw: '', reason: 'Required field missing — row skipped' });
        logEntries.push({ sourceRow: r, field: 'name_of_road', rawValue: '', action: 'skipped_row', note: 'Missing road name' });
        continue;
      }

      const shName = get(row, 'shName') || null;
      const divisionRaw = get(row, 'division');
      let divisionId: number | null = null;
      try {
        divisionId = await resolveDivision(divisionRaw);
      } catch (e) {
        issues.push({ sheetRow: r, field: 'division', raw: divisionRaw, reason: `Could not resolve division: ${(e as Error).message}` });
      }

      const civilRaw = get(row, 'civil');
      const layoutRaw = get(row, 'layout');
      const siRaw = get(row, 'si');
      const notifRaw = get(row, 'notification');
      const operatorRaw = get(row, 'operator');
      const civil = await resolveStatus('civil', civilRaw);
      const layout = await resolveStatus('layout', layoutRaw);
      const si = await resolveStatus('system_integrator', siRaw);
      const notif = await resolveStatus('toll_notification', notifRaw);
      const operator = await resolveStatus('toll_operator', operatorRaw);
      for (const [name, s, raw] of [
        ['civil', civil, civilRaw],
        ['layout', layout, layoutRaw],
        ['system_integrator', si, siRaw],
        ['toll_notification', notif, notifRaw],
        ['toll_operator', operator, operatorRaw],
      ] as const) {
        if (s.relabel) {
          logEntries.push({ sourceRow: r, field: `status_${name}`, rawValue: raw, action: 'relabelled', note: s.relabel });
        }
        if (!s.id && raw.trim()) {
          issues.push({ sheetRow: r, field: `status_${name}`, raw, reason: `Unknown status value "${raw}"` });
          logEntries.push({ sourceRow: r, field: `status_${name}`, rawValue: raw, action: 'unknown_status', note: `No vocabulary row for "${raw}"` });
        }
      }

      const chainageRaw = get(row, 'chainage');
      const ch = parseChainage(chainageRaw);
      const latRaw = get(row, 'latitude');
      const longRaw = get(row, 'longitude');
      const lat = parseCoord(latRaw);
      const long = parseCoord(longRaw);
      if (lat.review || long.review) {
        if (latRaw || longRaw) {
          logEntries.push({ sourceRow: r, field: 'coordinates', rawValue: `${latRaw}, ${longRaw}`, action: 'needs_review', note: 'Non-numeric or missing coordinates' });
        }
      }

      const apcRaw = get(row, 'apc');
      const apc = apcRaw && Number.isFinite(Number(apcRaw)) ? apcRaw : null;
      if (apc && Number(apc) < 0) {
        logEntries.push({ sourceRow: r, field: 'apc', rawValue: apcRaw, action: 'flagged_negative', note: 'Negative APC retained' });
      }

      let plazaTypeRaw = get(row, 'plazaType') || null;
      if (plazaTypeRaw === '(1+1) X 2 = 4 LANE TOLL PLAZA(Stagereed)') {
        plazaTypeRaw = '(1+1) X 2 = 4 LANE TOLL PLAZA(Staggered)';
        logEntries.push({ sourceRow: r, field: 'plaza_type', rawValue: '(1+1) X 2 = 4 LANE TOLL PLAZA(Stagereed)', action: 'typo_fixed', note: 'Stagereed -> Staggered' });
      }
      if (plazaTypeRaw === '(1+1) = 2 LANE TOLL PLAZA') {
        plazaTypeRaw = '1+1 = 2 LANE TOLL PLAZA';
        logEntries.push({ sourceRow: r, field: 'plaza_type', rawValue: '(1+1) = 2 LANE TOLL PLAZA', action: 'merged', note: '(1+1) = 2 LANE -> 1+1 = 2 LANE' });
      }
      if (plazaTypeRaw === '(1)x2 = 2 lane') {
        plazaTypeRaw = '1+1 = 2 LANE TOLL PLAZA';
        logEntries.push({ sourceRow: r, field: 'plaza_type', rawValue: '(1)x2 = 2 lane', action: 'merged', note: '(1)x2 = 2 lane -> 1+1 = 2 LANE TOLL PLAZA' });
      }
      if (plazaTypeRaw === '(2+1)x2 = 6 lane(Staggered)') {
        plazaTypeRaw = '(2+1) X 2 = 6 LANE STAGGERED';
        logEntries.push({ sourceRow: r, field: 'plaza_type', rawValue: '(2+1)x2 = 6 lane(Staggered)', action: 'merged', note: '(2+1)x2 = 6 lane(Staggered) -> (2+1) X 2 = 6 LANE STAGGERED' });
      }

      const lfRaw = get(row, 'locationFinalized');
      const locationFinalized = locationFinalizedFromCell(lfRaw);
      if (lfRaw && !locationFinalized) {
        issues.push({ sheetRow: r, field: 'location_finalized', raw: lfRaw, reason: `Unknown value "${lfRaw}". Expected one of: ${LOCATION_FINALIZED_OPTIONS.join(', ')}` });
        logEntries.push({ sourceRow: r, field: 'location_finalized', rawValue: lfRaw, action: 'unknown_status', note: 'Unknown Location Finalized value — stored NULL' });
      }

      try {
        await db.insert(tollPlazas).values({
          sNo: Number.isFinite(sNo) ? sNo : null,
          plazaCode: get(row, 'plazaCode') || null,
          plazaName: null,
          roadName,
          shName,
          divisionId,
          villageName: get(row, 'villageName') || null,
          chainageRaw: ch.raw,
          chainageM: ch.meters,
          latitude: lat.v,
          longitude: long.v,
          coordsNeedReview: lat.review || long.review,
          roadLen2laneKm: parseKm(get(row, 'roadLen2lane')),
          roadLen4laneKm: parseKm(get(row, 'roadLen4lane')),
          structLen2laneKm: parseKm(get(row, 'structLen2lane')),
          structLen4laneKm: parseKm(get(row, 'structLen4lane')),
          apc,
          plazaTypeRaw,
          plazaType: null,
          locationFinalized,
          civilStatusId: civil.id,
          layoutStatusId: layout.id,
          siStatusId: si.id,
          notificationStatusId: notif.id,
          operatorStatusId: operator.id,
          updatedBy: req.user?.id ?? null,
        });
        imported++;
        logEntries.push({ sourceRow: r, field: '*', rawValue: null, action: 'inserted', note: `by user ${req.user?.id}` });
      } catch (e) {
        issues.push({ sheetRow: r, field: '*', raw: '', reason: (e as Error).message });
      }
    }

    if (logEntries.length) await db.insert(importLog).values(logEntries);

    res.status(201).json({
      imported,
      skipped: issues.length,
      issues,
      sheet: SHEET_NAME,
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` });
      return;
    }
    next(e);
  }
});
