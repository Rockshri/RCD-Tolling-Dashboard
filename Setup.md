# RCD Toll Plaza Monitor: Build Specification

Monitoring and data-entry dashboard for the Road Construction Department (RCD), Bihar. It tracks toll plazas (including bridge toll plazas) through five statuses, lets authorised users enter and edit plaza details, attach a PDF and a geolocation image to each plaza, and download a plaza's full details.

Stack: React + Tailwind (frontend), Node.js + Express (API), PostgreSQL (database), **Drizzle ORM** (schema, queries and migrations).

Source workbook: `One Toll Plaza Details Dashboard dt 31.10.2026.xlsx`. Raw export of its real values: `toll_plazas_seed_raw.csv` (92 rows, untouched).

---

## 0. Rules for Claude Code

1. Do not invent data, field meanings or business rules. If a point is not in this file or the workbook, ask the user first.
2. Anything marked **CONFIRM** is a proposal or an interpretation, not a fact. Ask before building on it.
3. Do not expand the abbreviation "APC". The workbook does not say what it means. Use the column name as is.
4. Do not silently fix source data. Clean on import and write a log of every change (see section 3).
5. Use **Drizzle ORM** for all database access, schema and migrations (section 5). Do not add another ORM or query builder, and do not hand-write migration SQL.
6. The dashboard has **seven filters** (Zone, Division, Civil Work, Layout, System Integrator, Toll Notification, Name of Toll Operator) and every KPI, status card and table row must respond to them through one shared `buildWhere()` (sections 4.1.1 and 5.4).
7. Please do not Hallucianate.
8. Ask before Assuming.
9. Proceed phase by phase.

---

## 1. Source workbook map

| Sheet | State | Use |
|---|---|---|
| `Details of Toll` | visible | **Master data. Import this.** 92 rows, 24 columns (A to X) |
| `Dashboard` | visible | Read-only view of `Details of Toll` through formulas. Do not import; rebuild as the dashboard |
| `Summary` | visible | **Ignore** (user instruction) |
| `Sheet1`, `24.10.2026` | hidden | Older versions. Ignore |
| `Sheet2` | hidden | Lookup of bridge/plaza names with alternative coordinates. See open question 8 |

### 1.1 Columns in `Details of Toll`

| Col | Field | Type / notes |
|---|---|---|
| A | S. No | Integer 1 to 92, formula `=previous+1` |
| B | Toll Plaza Code | **Blank for all 92 rows** |
| C | Village Name | Text. Blank for 40 rows |
| D | Chanainage of Toll Plaza | Text like `13+800`. Contains the word `Cancelled` in 14 rows and is blank in 11 rows. Header has a typo ("Chanainage") |
| E | Latitude | Decimal degrees (now decimal, not DMS). Missing or invalid for 16 rows |
| F | Longitude | Decimal degrees |
| G | Name of Road | Text. For bridge entries this is the bridge description |
| H | SH Name | `SH-85` etc. The value `Bridge` is used for 34 rows |
| I | Division | Text, 43 raw spellings (section 3) |
| J | Length of Road 2 Lane (without Str) | km |
| K | Length of Road >=4 Lane (without Str) | km |
| L | Total Road Length (Km) | **Formula** `=J+K` |
| M | Structure >60 m (2 lane) | km |
| N | Structure >60 m (>=4 lane) | km |
| O | Total Structure Length | **Formula** `=M+N` |
| P | Total Length | **Formula** `=L+O` |
| Q | Equivalent Length | **Formula** `=IF((J+K+M*10+N*10)>(P*5), P*5, J+K+M*10+N*10)`, i.e. the smaller of `J+K+10*(M+N)` and `5*P`. Replaces the old "Virtual Length" |
| R | APC | Number. Blank for 50 rows, negative for 13 rows. Meaning not stated |
| S | Type of Plaza | Text, 11 raw spellings, blank for 7 rows |
| T | Status of Civil Work | See 2.1 |
| U | Status of Layout | See 2.1 |
| V | Status of System Integrator | For cancelled rows this is a formula that copies column T |
| W | Status of Toll Notification | For cancelled rows this is a formula that copies column T |
| X | Name of Toll Operator | Holds a status-like value (`RFP Floated` or `Cancelled`), not an operator name. For cancelled rows a formula copies column T |

Totals from the real data: 92 entries (58 road entries with an SH name, 34 bridge entries), about 3,304.8 km road length, about 76.66 km structure length. 14 entries are cancelled (9 of them bridge entries).

---

## 2. The five status cards

The `Dashboard` sheet shows five status columns. The five cards below follow those columns. **CONFIRM** that the fifth card should be "Toll Operator"; the user said "five statuses" without naming them.

| # | Card title | Source column |
|---|---|---|
| 1 | Status of Civil Work | T |
| 2 | Status of Layout | U |
| 3 | Status of System Integrator | V |
| 4 | Status of Toll Notification | W |
| 5 | Name of Toll Operator | X |

Each card shows: the title, a total, a proportion bar, and one row per status with its count of plazas. Clicking a status row on any of the five cards sets the matching filter (and clears it when clicked again), and the filter bar updates to match. Counts come from SQL (`GROUP BY`, Drizzle) and follow all seven active filters, so every card total equals the filtered plaza count. **CONFIRM** this rule (open question 15). Blank values are shown as **Not updated** (a real, countable bucket, not hidden).

### 2.1 Real status values found in the workbook (use these as the initial vocabularies)

| Field | Values (count of 92, after Change Request 01) |
|---|---|
| Civil Work | `Work started` (56), `Not Feasible` (14), `Work not started` (2), blank (20) |
| Layout | `Done` (7), `Not Feasible` (0), `In-process` (0), blank (85) |
| System Integrator | `RFP Floated` (78), `Not Feasible` (14) |
| Toll Notification | `In-process` (10), `Not Feasible` (14), blank (68) |
| Toll Operator | `RFP Floated` (78), `Not Feasible` (14) |

> **Change Request 01 (2026-11-02):** The workbook value `Cancelled` is relabelled to `Not Feasible` on import, and `In Process`/`In process` is normalised to `In-process`. Layout gains `Not Feasible` and `In-process` as options (0 and 0 on the seed). Internal keys and column names unchanged; only displayed labels change. See `Request_UI_Changes.md`.

Store each vocabulary in a table (section 5) so RCD can add values such as `Completed` without a code change. Do not invent additional values in the seed data.

Colour mapping for pills (solid fills, white text; "no light shades" was an explicit user request): done/completed = green, in progress / started / RFP floated = amber, not started = red, not_feasible = dark grey, not updated = grey. **CONFIRM** which real values count as green, amber or red.

---

## 3. Data quality issues (verified in the file)

Handle in the import step and write each change to `import_log`.

1. **Division spellings**, 43 raw values. Visible variants: `jamui`, `muzaffarpur` (lowercase), `Patna city`, `Shergahti` (probably Sherghati), `Sitamari` (probably Sitamarhi), `Dehri`, `Saharsa`, `Purnia`. Keep the raw value in an alias table and map it to a canonical division. **CONFIRM** the canonical list.
2. **Type of Plaza**, 11 raw spellings plus 7 blank rows, for what looks like a handful of types (for example `(1+1) X 2 = 4 LANE TOLL PLAZA(Staggered)` and `...(Stagereed)`, `(1)x2 = 2 lane`, `1+1 = 2 LANE TOLL PLAZA`). Store raw text, and map to a canonical type only after the user confirms the list.
3. **Latitude/Longitude**: 16 rows are unusable: 14 are blank, and 2 have a stray trailing `S` in the longitude (sheet row 23, `85.112255S`; sheet row 88, `85.171359S`). Sheet row = S. No + 1. Do not guess; flag these rows as "coordinates need review".
4. **Chainage** contains the text `Cancelled` in 14 rows and is blank in 11 rows. Keep the raw text and parse a numeric `chainage_m` only when it matches `digits+digits`.
5. **Negative APC** in 13 rows (mostly bridge entries). **CONFIRM** if valid. APC is blank in 50 rows.
6. **Toll Notification** has `In Process` and `In process`. Normalise case.
7. **Cancelled rows** (14): T, V, W, X are all `Cancelled`; V, W, X are formulas copying T. Store `Cancelled` as a status value on each field, and also expose an `is_cancelled` flag derived from Civil Work.
8. **Plaza code** and several **Village Name** values are blank.
9. **Hidden `Sheet2`** has its own coordinates. Of 65 rows that match `Details of Toll` by name and have coordinates in both, 28 differ by more than 0.0001 degrees (for example the first Ganga bridge: 25.69513, 84.795882 in `Sheet2` vs 25.694169, 84.79496 in `Details of Toll`). **CONFIRM** which is authoritative. Until then use `Details of Toll`.

Bridge entries (SH Name = `Bridge`) share the same table as road toll plazas. Add a derived `entry_kind` (`road` / `bridge`) from SH Name and expose it as an optional filter. **CONFIRM** that bridges belong in the same dashboard.

---

## 4. Features

### 4.1 Dashboard page

1. **Filter bar**: seven filters that combine with AND: **Zone, Division, Status of Civil Work, Status of Layout, Status of System Integrator, Status of Toll Notification, Name of Toll Operator**. Also a free-text search (road, plaza name, SH name) and "Clear all".
   - **Zone**: North, South, Simanchal, with divisions grouped under each. **No zone mapping exists in the workbook.** Keep the Zone filter disabled with a note until the mapping is supplied. Once enabled, choosing a Zone narrows the Division list, and changing Zone clears a Division that does not belong to it.
   - **Division**: canonical division names (section 3, item 1).
   - **Status filters** (Civil Work, Layout, System Integrator, Toll Notification): the values from that field's vocabulary (section 2.1) plus **Not updated** for blank values.
   - **Name of Toll Operator**: filters on the Toll Operator field (column X). In the workbook this field currently holds `RFP Floated` or `Cancelled`, not operator names. List the values as found; keep the label as the user named it. **CONFIRM** (open question 1).
   - Controls are single-select dropdowns by default. **CONFIRM** if multi-select is wanted (open question 14).
   - Filter state lives in the URL query string (`?zone=&division=&civil=&layout=&si=&notification=&operator=&q=`), so a filtered view can be bookmarked and shared, and a reload restores it.
2. **Dynamic KPI strip**: Toll Plazas (count), Total Road Length (km), Total Structure Length (km), Divisions Covered, Not Feasible. No "Average APC" card (the user removed it earlier).
3. **Five status cards** (section 2).
4. **Register table** with columns (Change Request 01): **Toll Plaza Code**, Name of Road, Chainage, SH Name, APC, Type of Plaza, Status of Civil Work, Status of Layout, Status of System Integrator, Status of Toll Notification, Name of Toll Operator. The first column shows `plaza_code`; when blank, display **Not assigned** in solid dark text (never generate a code). The `plaza_name` field is kept in the DB and the input form but hidden from the register. The column header row is **sticky** below the fixed page header while scrolling.
5. Sortable columns. Clicking a row opens the detail view (4.3).
6. **No horizontal overflow**: the table fits its container at desktop width; at 1020px and below rows become stacked cards with labels.
7. Light and dark themes. "Data as of" comes from the database (latest `updated_at`), not hardcoded.

#### 4.1.1 How the filters drive the KPIs

| Element | Responds to the seven filters? |
|---|---|
| KPI strip (5 KPIs) | Yes |
| Five status cards (counts, bars, totals) | Yes |
| Register table and "Showing X of Y" | Yes |
| "Data as of" date | No |

Rules:
- One shared server-side `buildWhere(filters)` function (section 5.4) builds the filter condition. `GET /summary` (KPIs and card counts) and `GET /plazas` (table) both use it, so the KPIs, cards and table can never disagree.
- The client sends the same query string to both requests whenever any filter changes. Keep the previous numbers visible while the new ones load (no blank flash). Debounce the search box by about 300 ms.
- Every card total equals the filtered plaza count, because all seven filters apply to every card. **CONFIRM** (open question 15). The alternative is that each card ignores its own filter, so people can compare other statuses without clearing.
- Clicking a status row on any of the five cards sets the matching filter, and the filter bar updates to match. Clicking it again clears it.
- Empty result: show "No toll plazas match the current filters" with a "Clear all" button. KPIs show 0, not blank.
- Selecting a filter value never hides that value from its own dropdown; show the count of matching plazas next to each option as a nice-to-have.

### 4.2 Input sheet (add / edit toll plaza)

**CONFIRM**: "input sheet" is read as a data-entry form screen for adding and editing a toll plaza, reachable from the dashboard ("Add toll plaza" button, and "Edit" in the detail view). If a spreadsheet-style grid or Excel bulk upload is also wanted, say so.

Sections and fields (all from the workbook's columns):

- **Identification**: Toll Plaza Code, Name of Toll Plaza (new, not in workbook), Name of Road, SH Name, Division (dropdown), Village Name, Chainage (`km+m`).
- **Location**: Latitude, Longitude (decimal degrees, validated to the Bihar area, roughly 24 to 28 N and 83 to 89 E; **CONFIRM** this range).
- **Lengths (km)**: Road 2 Lane, Road >=4 Lane, Structure >60 m 2 lane, Structure >60 m >=4 lane. These four are inputs.
- **Auto-calculated, read-only** (same formulas as the workbook): Total Road Length = 2 lane + >=4 lane; Total Structure Length = structure 2 lane + >=4 lane; Total Length = total road + total structure; Equivalent Length = `MIN(road2 + road4 + 10 * structures, 5 * Total Length)`.
- **Plaza**: Type of Plaza (dropdown), APC (number; keep the label "APC").
- **Statuses** (dropdowns from the status vocabularies): Civil Work, Layout, System Integrator, Toll Notification, Toll Operator.
- **Attachments** (4.2.1).

Validation: required = Name of Road, Division, SH Name; numbers non-negative for lengths; duplicate warning if the same Name of Road + Chainage exists. APC may be negative in the data, so do not block negatives (flag only). Show inline errors; save disabled until valid. Every save writes an audit row (who, when, field, old, new).

#### 4.2.1 File uploads in the input sheet

- **PDF document**: one or more PDFs per plaza.
- **Geolocation image**: one or more photos (JPG/PNG), meant to show the plaza's location. **CONFIRM** whether "geolocation image" means a geotagged photo (GPS in the image's EXIF data), a map screenshot, or both.
- Proposed limits (**CONFIRM**): PDF up to 10 MB each, image up to 10 MB each, up to 10 files per plaza per type.
- Validate type by file content (magic bytes), not by extension only. Reject anything else.
- Proposed: if an image has GPS EXIF data, read it and show the coordinates next to the entered latitude/longitude, with a warning when they differ. Do not overwrite the entered coordinates automatically. **CONFIRM** this behaviour.
- Show upload progress, a file list with name, size, uploader, date, a preview for images, and a delete action (with an in-page confirmation, not a browser dialog).
- Store files outside the web root; serve only through authenticated API routes. Storage location (server disk or object storage) **CONFIRM**.

### 4.3 Full-details view (centred modal) and download

> **Change Request 01 (2026-11-02):** This view is a **centred modal dialog** (`PlazaDetailModal`), not a right-side drawer. Opens with a short fade+scale; closes with ×, Esc, or backdrop click; focus trapped inside and returned to the clicked row. Phone widths fill the screen. The Status section inside the modal shows **five labelled rows** in a fixed order (Status of Civil Work, Status of Layout, Status of System Integrator, Status of Toll Notification, Name of Toll Operator), each with a solid-colour status pill or **Not updated** for a blank value.


Opens on row click. Sections: Location (road, village, chainage, SH, division, latitude, longitude), Road and Plaza (type, all lengths, Equivalent Length, APC), Status (five statuses), Attachments (PDF list, image gallery), and buttons **Edit** and **Download**.

**Download** (the user asked for a download option here). Proposed default (**CONFIRM** the exact formats):
1. **Download details as PDF**: a one-plaza report with all fields above, the status pills in text form, and the geolocation image(s) embedded.
2. **Download attachments**: each uploaded PDF or image individually, and "Download all (ZIP)".
3. Optional: details as a single-row Excel/CSV file.

---

## 5. Database with Drizzle ORM (PostgreSQL), CONFIRM before building

Use **Drizzle ORM** for the schema, every query and all migrations. No other ORM or query builder, and no hand-written migration SQL: change `schema.ts`, then run `drizzle-kit generate` and `drizzle-kit migrate`. Use Drizzle's `sql` helper only for aggregates and generated columns.

Drizzle is TypeScript-first, so the server code is written in TypeScript. **CONFIRM** (open question 13).

The code below follows the current Drizzle docs (generated columns with `generatedAlwaysAs`, dynamic `and(...)` filters, `groupBy` aggregates) but has **not been compiled or run**. After scaffolding, run `tsc` and `drizzle-kit generate` first; if either reports an error, fix it against the installed version's docs. Drizzle APIs change between versions.

### 5.1 Setup

```
npm i drizzle-orm pg
npm i -D drizzle-kit
```

Suggested layout:

```
server/
  drizzle.config.ts
  drizzle/                 generated migrations (commit them)
  src/db/schema.ts
  src/db/client.ts
  src/db/filters.ts        buildWhere(), shared by summary and list
  src/db/summary.ts        KPI and status-card queries
  src/scripts/import.ts    CSV/Excel -> database, writes import_log
```

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

```ts
// src/db/client.ts  (check the connection syntax for the installed drizzle-orm version)
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
```

### 5.2 Schema

```ts
// src/db/schema.ts
import { sql, SQL } from 'drizzle-orm';
import {
  pgTable, pgEnum, serial, bigserial, integer, text, numeric,
  boolean, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const statusFieldEnum = pgEnum('status_field', [
  'civil', 'layout', 'system_integrator', 'toll_notification', 'toll_operator',
]);
export const statusToneEnum = pgEnum('status_tone', [
  'done', 'progress', 'pending', 'not_feasible', 'neutral',   // 'cancelled' renamed → 'not_feasible' (CR-01)
]);
export const fileKindEnum = pgEnum('file_kind', ['pdf', 'geo_image']);

export const zones = pgTable('zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),                    // North, South, Simanchal
});

export const divisions = pgTable('divisions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  zoneId: integer('zone_id').references(() => zones.id),    // NULL until the mapping is supplied
});

export const divisionAliases = pgTable('division_aliases', {
  rawName: text('raw_name').primaryKey(),                   // spelling found in the Excel file
  divisionId: integer('division_id').notNull().references(() => divisions.id),
});

// Status vocabularies are rows, so RCD can add values without a code change.
export const statusOptions = pgTable('status_options', {
  id: serial('id').primaryKey(),
  field: statusFieldEnum('field').notNull(),
  label: text('label').notNull(),
  tone: statusToneEnum('tone').notNull(),                   // drives the pill colour
  sortOrder: integer('sort_order').notNull(),
}, (t) => [uniqueIndex('status_options_field_label_uq').on(t.field, t.label)]);

const km = (name: string) => numeric(name, { precision: 9, scale: 3 });

export const tollPlazas = pgTable('toll_plazas', {
  id: serial('id').primaryKey(),
  sNo: integer('s_no'),
  plazaCode: text('plaza_code'),
  plazaName: text('plaza_name'),                            // new field, not in the workbook
  roadName: text('road_name').notNull(),
  shName: text('sh_name'),
  entryKind: text('entry_kind').generatedAlwaysAs(
    (): SQL => sql`case when lower(trim(${tollPlazas.shName})) = 'bridge' then 'bridge' else 'road' end`,
  ),
  divisionId: integer('division_id').references(() => divisions.id),
  villageName: text('village_name'),
  chainageRaw: text('chainage_raw'),                        // '13+800', 'Cancelled' or NULL
  chainageM: integer('chainage_m'),                         // parsed only when valid
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  coordsNeedReview: boolean('coords_need_review').notNull().default(false),

  // Inputs
  roadLen2laneKm: km('road_len_2lane_km'),
  roadLen4laneKm: km('road_len_4lane_plus_km'),
  structLen2laneKm: km('structure_len_2lane_km'),
  structLen4laneKm: km('structure_len_4lane_plus_km'),

  // Calculated, same formulas as the workbook. Postgres generated columns cannot
  // reference other generated columns, so each one uses the four input columns.
  roadLenTotalKm: km('road_len_total_km').generatedAlwaysAs(
    (): SQL => sql`coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)`,
  ),
  structLenTotalKm: km('structure_len_total_km').generatedAlwaysAs(
    (): SQL => sql`coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)`,
  ),
  totalLenKm: km('total_len_km').generatedAlwaysAs(
    (): SQL => sql`coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)
      + coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)`,
  ),
  equivalentLenKm: km('equivalent_len_km').generatedAlwaysAs(
    (): SQL => sql`least(
      coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)
        + 10 * (coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)),
      5 * (coalesce(${tollPlazas.roadLen2laneKm},0) + coalesce(${tollPlazas.roadLen4laneKm},0)
        + coalesce(${tollPlazas.structLen2laneKm},0) + coalesce(${tollPlazas.structLen4laneKm},0)))`,
  ),

  apc: numeric('apc', { precision: 10, scale: 2 }),         // meaning unconfirmed
  plazaTypeRaw: text('plaza_type_raw'),                     // raw spelling kept
  plazaType: text('plaza_type'),                            // canonical; NULL until the list is confirmed

  civilStatusId: integer('civil_status_id').references(() => statusOptions.id),
  layoutStatusId: integer('layout_status_id').references(() => statusOptions.id),
  siStatusId: integer('si_status_id').references(() => statusOptions.id),
  notificationStatusId: integer('notification_status_id').references(() => statusOptions.id),
  operatorStatusId: integer('operator_status_id').references(() => statusOptions.id),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  updatedBy: integer('updated_by'),
}, (t) => [
  // One index per filter column, because every dashboard request filters on them.
  index('toll_plazas_division_idx').on(t.divisionId),
  index('toll_plazas_civil_idx').on(t.civilStatusId),
  index('toll_plazas_layout_idx').on(t.layoutStatusId),
  index('toll_plazas_si_idx').on(t.siStatusId),
  index('toll_plazas_notification_idx').on(t.notificationStatusId),
  index('toll_plazas_operator_idx').on(t.operatorStatusId),
  index('toll_plazas_entry_kind_idx').on(t.entryKind),
]);

export const plazaFiles = pgTable('plaza_files', {
  id: serial('id').primaryKey(),
  plazaId: integer('plaza_id').notNull().references(() => tollPlazas.id, { onDelete: 'cascade' }),
  kind: fileKindEnum('kind').notNull(),
  originalName: text('original_name').notNull(),
  storageKey: text('storage_key').notNull(),                // path or object key, never sent to the client
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  exifLat: numeric('exif_lat', { precision: 9, scale: 6 }), // only if present in the image
  exifLong: numeric('exif_long', { precision: 9, scale: 6 }),
  uploadedBy: integer('uploaded_by'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  plazaId: integer('plaza_id'),
  field: text('field'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedBy: integer('changed_by'),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const importLog = pgTable('import_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sourceRow: integer('source_row'),
  field: text('field'),
  rawValue: text('raw_value'),
  action: text('action'),
  note: text('note'),
});
```

Notes:
- Drizzle returns `numeric` columns as strings. Convert to numbers in the API layer; never do arithmetic on the strings in the browser.
- Users and roles tables are deferred until open question 6 is answered.
- Optional: add Drizzle `relations()` if the relational query API (`db.query...`) is wanted for the details view.

### 5.3 Migrations and seed

1. `npx drizzle-kit generate` creates SQL in `drizzle/`; `npx drizzle-kit migrate` applies it. Commit the generated files.
2. `src/scripts/import.ts` reads `toll_plazas_seed_raw.csv`, applies the cleaning rules in section 3 inside one transaction, inserts with `db.insert(...).values(...)`, and writes every change to `import_log`.
3. Seed `zones` (North, South, Simanchal) and `status_options` (section 2.1 values only). Do not seed divisions' zone ids until the mapping exists.
4. Acceptance test after import: 92 plazas; status counts equal the table in section 2.1.

### 5.4 Filter helper (shared by every dashboard request)

```ts
// src/db/filters.ts
import { and, eq, ilike, inArray, isNull, or, SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from './client';
import { divisions, tollPlazas } from './schema';

// A status filter is a status_options id, or 'none' for "Not updated" (blank).
type StatusFilter = number | 'none';

export type Filters = {
  zone?: number;
  division?: number;
  civil?: StatusFilter;
  layout?: StatusFilter;
  si?: StatusFilter;
  notification?: StatusFilter;
  operator?: StatusFilter;
  q?: string;
};

const status = (col: AnyPgColumn, v?: StatusFilter): SQL | undefined =>
  v === undefined ? undefined : v === 'none' ? isNull(col) : eq(col, v);

// and() ignores undefined entries, so unset filters add nothing to the query.
export function buildWhere(f: Filters): SQL | undefined {
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
    f.q
      ? or(
          ilike(tollPlazas.roadName, `%${f.q}%`),   // escape % and _ in q before use
          ilike(tollPlazas.plazaName, `%${f.q}%`),
          ilike(tollPlazas.shName, `%${f.q}%`),
        )
      : undefined,
  );
}
```

### 5.5 Summary queries (KPIs and the five cards)

```ts
// src/db/summary.ts
import { count, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { buildWhere, Filters } from './filters';
import { statusOptions, tollPlazas } from './schema';

const cardColumns = {
  civil: tollPlazas.civilStatusId,
  layout: tollPlazas.layoutStatusId,
  system_integrator: tollPlazas.siStatusId,
  toll_notification: tollPlazas.notificationStatusId,
  toll_operator: tollPlazas.operatorStatusId,
} as const;

export async function getSummary(filters: Filters) {
  const where = buildWhere(filters);

  // Dynamic KPIs. Casts keep Postgres bigint/numeric results as JS numbers.
  const [kpis] = await db
    .select({
      plazas: count(),
      roadKm: sql<number>`coalesce(sum(${tollPlazas.roadLenTotalKm}), 0)::float`,
      structureKm: sql<number>`coalesce(sum(${tollPlazas.structLenTotalKm}), 0)::float`,
      divisions: sql<number>`count(distinct ${tollPlazas.divisionId})::int`,
      notFeasible: sql<number>`(count(*) filter (where ${statusOptions.tone} = 'not_feasible'))::int`,   // key renamed CR-01
    })
    .from(tollPlazas)
    .leftJoin(statusOptions, eq(tollPlazas.civilStatusId, statusOptions.id))   // "Cancelled" = Civil Work status
    .where(where);

  // Five status cards: one grouped count per status column, same filter.
  const cards = await Promise.all(
    Object.entries(cardColumns).map(async ([field, col]) => ({
      field,
      rows: await db
        .select({ statusId: col, label: statusOptions.label, n: count() })
        .from(tollPlazas)
        .leftJoin(statusOptions, eq(col, statusOptions.id))
        .where(where)
        .groupBy(col, statusOptions.label),
    })),
  );
  // In the API layer: merge each card with its full vocabulary from status_options so
  // statuses with 0 plazas still appear, and label rows with a NULL statusId "Not updated".

  return { kpis, cards };
}
```

## 6. Proposed API (Express), CONFIRM

All routes under `/api`, JSON, request bodies and query strings validated with a schema library (for example zod). All database access goes through Drizzle (section 5).

### 6.1 Filter query string (used by `/summary` and `/plazas`)

| Param | Meaning |
|---|---|
| `zone` | zone id |
| `division` | division id |
| `civil` | Civil Work status id, or `none` for Not updated |
| `layout` | Layout status id, or `none` |
| `si` | System Integrator status id, or `none` |
| `notification` | Toll Notification status id, or `none` |
| `operator` | Name of Toll Operator status id, or `none` |
| `q` | free-text search (road, plaza name, SH name) |

Unknown params are rejected with 400. Omitted params mean "no filter". Parse them into the `Filters` type from section 5.4 and call `buildWhere()`; no route builds its own WHERE clause.

### 6.2 Routes

| Method and path | Purpose |
|---|---|
| `GET /filters` | Zones, divisions (with `zoneId`), and status options per field (id, label, tone). Used to fill the seven filter dropdowns |
| `GET /summary?<filters>` | `{ kpis, cards }`: the five KPIs and the five status-card counts for the filtered set |
| `GET /plazas?<filters>&sort=&dir=&page=&pageSize=` | Register rows and `total` (the filtered count) |
| `GET /plazas/:id` | Full detail including file metadata |
| `POST /plazas` | Create (input form) |
| `PUT /plazas/:id` | Update (input form), writes `audit_log` |
| `POST /plazas/:id/files` | Multipart upload, field `kind` = `pdf` or `geo_image` |
| `GET /plazas/:id/files/:fileId` | Download one file (authenticated) |
| `DELETE /plazas/:id/files/:fileId` | Delete a file |
| `GET /plazas/:id/download` | Details PDF |
| `GET /plazas/:id/download-all` | ZIP of details PDF and all attachments |

Suggested libraries (not mandatory): `multer` for uploads, `file-type` for magic-byte checks, `exifr` for EXIF GPS, `pdfkit` or a headless-browser renderer for the details PDF, `archiver` for ZIP, `exceljs` for the Excel import script.

Security: authentication on every write and file route, rate limits on uploads, filenames never used as storage paths, `Content-Disposition: attachment` on downloads.

## 7. Frontend (React + Tailwind)

Pages: `/` Dashboard, `/plazas/new` and `/plazas/:id/edit` Input form, `/plazas/:id` Details (the drawer may also deep-link here).

Components: `Header`, `KpiStrip`, `StatusCard` (x5), `FilterBar` (seven filters) with a `useFilters` hook (URL-synced filter state shared by the summary and table requests), `PlazaTable` (with mobile card variant), `PlazaDrawer`, `PlazaForm` (sectioned), `FileUploader` (PDF and image variants), `StatusPill`, `ConfirmInline`.

Design direction carried over from the approved prototype (user asked: no light shades, bigger fonts, clear numbers):
- Fonts: Barlow (body, 16px base) and Barlow Semi Condensed (headings and all numbers, bold, tabular figures).
- Solid saturated status pills with white text. Palette: accent teal `#0c5f64`, header and table head `#083e42`, page `#e7ebf0`, card `#ffffff`, border `#c9d2db`, text `#101922`, green `#17803d`, amber `#b3630c`, red `#b32219`, grey `#5a6773`.
- KPI numbers about 38px bold; status counts about 18px bold.
- Dark theme supported through CSS variables mapped into the Tailwind theme.
- Five status cards must fit the grid cleanly: 5 across on wide screens, 2-3 across on tablet, 1 on phone.

---

## 8. Open questions (ask the user before the dependent work)

1. Confirm the five cards (assumed: Civil Work, Layout, System Integrator, Toll Notification, Toll Operator). Note that the field behind "Name of Toll Operator" currently holds `RFP Floated` / `Cancelled`, not operator names. Is that the intended filter and card?
2. Zone to division mapping for North, South and Simanchal.
3. Canonical division list and plaza type list (section 3, items 1 and 2).
4. Official plaza codes and names (both missing), and how names will be entered.
5. Meaning of "APC" and whether the negative values are valid.
6. Users and roles: who can view, edit, upload and delete; login method; any government single sign-on.
7. Upload rules: allowed types, size limits, files per plaza, what "geolocation image" must contain, whether EXIF GPS should be read.
8. Which coordinates are authoritative: `Details of Toll` or hidden `Sheet2`.
9. Download formats wanted in the detail view (PDF default; Excel/CSV and ZIP optional).
10. Are bridge entries (34) and cancelled entries (14) shown in the main dashboard by default, or behind a filter?
11. How data keeps flowing: one-time import only, periodic Excel re-import, or only through the input form.
12. Hosting and deployment constraints.
13. TypeScript on the server (Drizzle is TypeScript-first), and on the client too?
14. Filters: single-select dropdowns (assumed) or multi-select?
15. Status-card counts: should every card obey all seven filters (assumed), or should each card ignore its own filter?

---

## 9. Suggested build order

1. Scaffold: Vite + React + Tailwind client, Express server, Postgres, Drizzle (`drizzle.config.ts`, `schema.ts`, `client.ts`).
2. Generate and apply the first migration with `drizzle-kit`. Seed `zones` and `status_options`. Write the import script from `toll_plazas_seed_raw.csv` with `import_log`. Test: 92 rows load, counts match section 2.1.
3. `buildWhere()`, `getSummary()`, then `/filters`, `/summary`, `/plazas`, `/plazas/:id`. Tests against the 92-row seed: every combination of the seven filters returns the same plaza count from `/summary` (card totals and `kpis.plazas`) and `/plazas` (`total`).
4. Dashboard UI: header, seven-filter bar with URL-synced state, dynamic KPI strip, five status cards, table, details drawer. Responsive check at 360, 768 and 1280 px with no horizontal scroll.
5. Input form with calculated fields, validation and audit log.
6. File upload and storage, then downloads (details PDF, single files, ZIP).
7. Auth and roles (needed before enabling edit and upload outside a test environment).
8. Zones, canonical lists, and any confirmed rules from section 8.