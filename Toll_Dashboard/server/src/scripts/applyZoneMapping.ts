import 'dotenv/config';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { divisionAliases, divisions, tollPlazas, zones } from '../db/schema.js';

// ──────────────────────────────────────────────────────────────────────────
// Source of truth: ../../../../Zone-Division-mapping.md (2026-11-04).
// Zone names are the ones the user confirmed on 2026-11-04.
// ──────────────────────────────────────────────────────────────────────────

const ZONE_RENAME: Array<{ oldName: string; newName: string }> = [
  { oldName: 'South',    newName: 'South Bihar Zone' },
  { oldName: 'Simanchal', newName: 'Seemanchal Zone' },
  { oldName: 'North',    newName: 'North Bihar Zone' },
];

// File spelling → DB canonical name (when they differ)
const DIVISION_ALIASES: Array<{ raw: string; canonical: string }> = [
  { raw: 'Newada',       canonical: 'Nawada' },
  { raw: 'Bihar Sharif', canonical: 'Biharsharif' },
  { raw: 'Chhapra',      canonical: 'Chapra' },
  { raw: 'Jhanjarpur',   canonical: 'Jhanjharpur' },
  { raw: 'Sitamarhi',    canonical: 'Sitamari' },
];

// Zone label (file) → canonical DB division names
const MAPPING: Record<string, string[]> = {
  'South Bihar Zone': [
    'Ara', 'Buxar', 'Kochas', 'Dehri', 'Bhabhua', 'Arwal', 'Gaya', 'Aurangabad',
    'Shergahti', 'Jehanabad', 'Nawada', 'Hilsa', 'Biharsharif',
    'Patna West', 'Patna City', 'Lakhisarai', 'Jamui', 'Sheikhpura', 'Munger',
  ],
  'Seemanchal Zone': [
    'Banka', 'Bhagalpur', 'Kishanganj', 'Katihar', 'Purnia', 'Araria',
    'Khagaria', 'Madhepura', 'Saharsa', 'Supaul',
  ],
  'North Bihar Zone': [
    'Gopalganj', 'Siwan', 'Chapra', 'Hajipur', 'Begusarai', 'Jhanjharpur',
    'Benipur', 'Darbhanga', 'Rosera', 'Sitamari', 'Muzaffarpur',
    'Sheohar', 'Motihari', 'Bettiah',
  ],
};

async function main() {
  // 1. Rename zones.
  for (const { oldName, newName } of ZONE_RENAME) {
    const res = await db.update(zones).set({ name: newName }).where(eq(zones.name, oldName)).returning();
    console.log(`Zone: ${oldName} -> ${newName} (${res.length} updated)`);
  }

  // 2. Merge the stale "Patna" division into "Patna City" per user decision.
  const [patna] = await db.select().from(divisions).where(eq(divisions.name, 'Patna')).limit(1);
  const [patnaCity] = await db.select().from(divisions).where(eq(divisions.name, 'Patna City')).limit(1);
  if (patna && patnaCity) {
    const movedPlazas = await db
      .update(tollPlazas)
      .set({ divisionId: patnaCity.id })
      .where(eq(tollPlazas.divisionId, patna.id))
      .returning({ id: tollPlazas.id });
    console.log(`Merge: moved ${movedPlazas.length} plaza(s) from Patna -> Patna City`);

    // Re-point any aliases that pointed to Patna onto Patna City (may be none).
    await db
      .update(divisionAliases)
      .set({ divisionId: patnaCity.id })
      .where(eq(divisionAliases.divisionId, patna.id));

    // Record "Patna" as an alias of Patna City so future uploads of the raw
    // string "Patna" land in the right division.
    await db
      .insert(divisionAliases)
      .values({ rawName: 'Patna', divisionId: patnaCity.id })
      .onConflictDoNothing();

    await db.delete(divisions).where(eq(divisions.id, patna.id));
    console.log('Merge: deleted stale "Patna" division');
  } else if (patna && !patnaCity) {
    console.warn('WARN: Patna exists but Patna City does not — skipping merge');
  }

  // 3. Insert spelling-variant aliases so future uploads find the right division.
  for (const { raw, canonical } of DIVISION_ALIASES) {
    const [target] = await db.select().from(divisions).where(eq(divisions.name, canonical)).limit(1);
    if (!target) { console.warn(`WARN: canonical "${canonical}" missing — alias "${raw}" skipped`); continue; }
    const inserted = await db
      .insert(divisionAliases)
      .values({ rawName: raw, divisionId: target.id })
      .onConflictDoNothing()
      .returning();
    console.log(`Alias: "${raw}" -> "${canonical}" (${inserted.length ? 'added' : 'already present'})`);
  }

  // 4. Assign zone_id on each division per the mapping.
  let matched = 0;
  const unmatched: string[] = [];
  for (const [zoneName, divs] of Object.entries(MAPPING)) {
    const [zone] = await db.select().from(zones).where(eq(zones.name, zoneName)).limit(1);
    if (!zone) throw new Error(`Zone not found after rename: ${zoneName}`);
    for (const d of divs) {
      const res = await db
        .update(divisions)
        .set({ zoneId: zone.id })
        .where(eq(divisions.name, d))
        .returning({ id: divisions.id });
      if (res.length === 0) unmatched.push(`${d} (zone: ${zoneName})`);
      else matched += 1;
    }
  }
  console.log(`Mapped ${matched} division(s) to a zone.`);
  if (unmatched.length) {
    console.warn('Unmatched divisions (not in DB):');
    for (const u of unmatched) console.warn('  -', u);
  }

  // 5. Report divisions that remain without a zone.
  const orphan = await db
    .select({ id: divisions.id, name: divisions.name })
    .from(divisions)
    .where(sql`${divisions.zoneId} is null`);
  if (orphan.length) {
    console.warn('\nDivisions still without a zone:');
    for (const d of orphan) console.warn(`  - id=${d.id} ${d.name}`);
  } else {
    console.log('\nAll divisions now have a zone. ✓');
  }

  await pool.end();
}

main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
