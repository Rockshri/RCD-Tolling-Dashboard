import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { and, eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import {
  divisionAliases, divisions, importLog, statusOptions, tollPlazas,
} from '../db/schema.js';

type Row = Record<string, string>;

const CSV_PATH = path.resolve(process.cwd(), '../../toll_plazas_seed_raw.csv');

function logChange(sourceRow: number, field: string, raw: string | null, action: string, note?: string) {
  return db.insert(importLog).values({
    sourceRow,
    field,
    rawValue: raw,
    action,
    note: note ?? null,
  });
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((t) => (/^\s+$|^-$/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1)))
    .join('')
    .trim();
}

async function upsertDivision(rawName: string, sourceRow: number): Promise<number | null> {
  const raw = (rawName ?? '').trim();
  if (!raw) return null;

  const existingAlias = await db
    .select({ divisionId: divisionAliases.divisionId })
    .from(divisionAliases)
    .where(eq(divisionAliases.rawName, raw))
    .limit(1);
  if (existingAlias[0]) return existingAlias[0].divisionId;

  const canonical = titleCase(raw);

  let [division] = await db.select().from(divisions).where(eq(divisions.name, canonical)).limit(1);
  if (!division) {
    [division] = await db.insert(divisions).values({ name: canonical }).returning();
    await logChange(sourceRow, 'division', raw, 'created_canonical', `Canonical division "${canonical}"`);
  }

  await db
    .insert(divisionAliases)
    .values({ rawName: raw, divisionId: division!.id })
    .onConflictDoNothing();

  if (canonical !== raw) {
    await logChange(sourceRow, 'division', raw, 'mapped_alias', `"${raw}" -> "${canonical}"`);
  }

  return division!.id;
}

async function resolveStatus(
  field: 'civil' | 'layout' | 'system_integrator' | 'toll_notification' | 'toll_operator',
  rawVal: string,
  sourceRow: number,
): Promise<number | null> {
  let v = (rawVal ?? '').trim();
  if (!v) return null;
  if (/^cancelled$/i.test(v)) {
    await logChange(sourceRow, `status_${field}`, rawVal, 'relabelled', `"Cancelled" -> "Not Feasible"`);
    v = 'Not Feasible';
  }
  if (/^in[\s-]process$/i.test(v)) {
    if (v !== 'In Process') {
      await logChange(sourceRow, `status_${field}`, rawVal, 'normalised_case', `"${v}" -> "In Process"`);
    }
    v = 'In Process';
  }
  if (/^work\s+not\s+started$/i.test(v) && field === 'civil') {
    await logChange(sourceRow, `status_${field}`, rawVal, 'relabelled', `"Work not started" -> "Yet to be Started"`);
    v = 'Yet to be Started';
  }
  const [opt] = await db
    .select()
    .from(statusOptions)
    .where(and(eq(statusOptions.field, field), eq(statusOptions.label, v)))
    .limit(1);
  if (!opt) {
    await logChange(sourceRow, `status_${field}`, rawVal, 'unknown_status', `No vocabulary row for "${v}"`);
    return null;
  }
  return opt.id;
}

function parseKm(s: string): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function parseChainage(s: string): { raw: string | null; meters: number | null; cancelled: boolean } {
  if (!s) return { raw: null, meters: null, cancelled: false };
  const t = s.trim();
  if (!t) return { raw: null, meters: null, cancelled: false };
  if (/^cancelled$/i.test(t)) return { raw: t, meters: null, cancelled: true };
  const m = t.match(/^(\d+)\+(\d+)$/);
  if (m && m[1] && m[2]) {
    return { raw: t, meters: Number(m[1]) * 1000 + Number(m[2]), cancelled: false };
  }
  return { raw: t, meters: null, cancelled: false };
}

async function parseLat(raw: string, sourceRow: number): Promise<{ v: string | null; review: boolean }> {
  const t = (raw ?? '').trim();
  if (!t) return { v: null, review: true };
  if (/[a-z]/i.test(t)) {
    await logChange(sourceRow, 'latitude', raw, 'needs_review', 'Non-numeric character in latitude');
    return { v: null, review: true };
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return { v: null, review: true };
  return { v: String(n), review: false };
}

async function parseLong(raw: string, sourceRow: number): Promise<{ v: string | null; review: boolean }> {
  const t = (raw ?? '').trim();
  if (!t) return { v: null, review: true };
  if (/[a-z]/i.test(t)) {
    await logChange(sourceRow, 'longitude', raw, 'needs_review', `Non-numeric character in longitude "${t}"`);
    return { v: null, review: true };
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return { v: null, review: true };
  return { v: String(n), review: false };
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as Row[];
  console.log(`Parsed ${rows.length} rows from CSV.`);

  await db.delete(tollPlazas);
  await db.delete(importLog);

  let inserted = 0;
  for (const r of rows) {
    const sNo = Number(r.s_no);
    const sheetRow = sNo + 1;

    const divisionId = await upsertDivision(r.division_raw ?? '', sheetRow);

    const civilStatusId = await resolveStatus('civil', r.status_civil_work ?? '', sheetRow);
    const layoutStatusId = await resolveStatus('layout', r.status_layout ?? '', sheetRow);
    const siStatusId = await resolveStatus('system_integrator', r.status_system_integrator ?? '', sheetRow);
    const notificationStatusId = await resolveStatus('toll_notification', r.status_toll_notification ?? '', sheetRow);
    const operatorStatusId = await resolveStatus('toll_operator', r.toll_operator_status ?? '', sheetRow);

    const ch = parseChainage(r.chainage ?? '');
    const lat = await parseLat(r.latitude ?? '', sheetRow);
    const lon = await parseLong(r.longitude ?? '', sheetRow);
    const coordsNeedReview = lat.review || lon.review;

    const apcRaw = (r.apc ?? '').trim();
    const apc = apcRaw && Number.isFinite(Number(apcRaw)) ? apcRaw : null;
    if (apc && Number(apc) < 0) {
      await logChange(sheetRow, 'apc', apcRaw, 'flagged_negative', 'Negative APC retained; meaning unconfirmed');
    }

    let plazaTypeRaw = (r.type_of_plaza ?? '').trim() || null;
    // Normalise the "Stagereed" typo from the source workbook to the correct "Staggered".
    if (plazaTypeRaw === '(1+1) X 2 = 4 LANE TOLL PLAZA(Stagereed)') {
      plazaTypeRaw = '(1+1) X 2 = 4 LANE TOLL PLAZA(Staggered)';
    }
    // Normalise "(1+1) = 2 LANE TOLL PLAZA" into the canonical "1+1 = 2 LANE TOLL PLAZA".
    if (plazaTypeRaw === '(1+1) = 2 LANE TOLL PLAZA') {
      plazaTypeRaw = '1+1 = 2 LANE TOLL PLAZA';
    }
    // Merge "(1)x2 = 2 lane" into the canonical "1+1 = 2 LANE TOLL PLAZA".
    if (plazaTypeRaw === '(1)x2 = 2 lane') {
      plazaTypeRaw = '1+1 = 2 LANE TOLL PLAZA';
    }
    // Merge "(2+1)x2 = 6 lane(Staggered)" into "(2+1) X 2 = 6 LANE STAGGERED".
    if (plazaTypeRaw === '(2+1)x2 = 6 lane(Staggered)') {
      plazaTypeRaw = '(2+1) X 2 = 6 LANE STAGGERED';
    }
    const roadName = (r.name_of_road ?? '').trim();
    if (!roadName) {
      await logChange(sheetRow, 'name_of_road', r.name_of_road ?? '', 'skipped_row', 'Missing road name (required)');
      continue;
    }

    await db.insert(tollPlazas).values({
      sNo,
      plazaCode: (r.plaza_code ?? '').trim() || null,
      plazaName: null,
      roadName,
      shName: (r.sh_name ?? '').trim() || null,
      divisionId,
      villageName: (r.village_name ?? '').trim() || null,
      chainageRaw: ch.raw,
      chainageM: ch.meters,
      latitude: lat.v,
      longitude: lon.v,
      coordsNeedReview,
      roadLen2laneKm: parseKm(r.road_len_2lane_km ?? ''),
      roadLen4laneKm: parseKm(r.road_len_4lane_plus_km ?? ''),
      structLen2laneKm: parseKm(r.structure_2lane_km ?? ''),
      structLen4laneKm: parseKm(r.structure_4lane_plus_km ?? ''),
      apc,
      plazaTypeRaw,
      plazaType: null,
      civilStatusId,
      layoutStatusId,
      siStatusId,
      notificationStatusId,
      operatorStatusId,
    });
    inserted++;
  }

  console.log(`Imported ${inserted} plazas.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
