# RCD Toll Plaza Monitor

Dashboard + data-entry app for the Road Construction Department, Bihar.
Spec: `../Setup.md`. Seed: `../toll_plazas_seed_raw.csv` (92 rows).

Stack: React + TypeScript + Tailwind (client), Node + Express + TypeScript (server), PostgreSQL + Drizzle ORM.

## Layout

```
Toll_Dashboard/
  client/          Vite + React
  server/          Express API, Drizzle schema, import script
    drizzle/       generated migrations (committed)
    storage/       uploaded files (git-ignored)
```

## Prereqs

- Node 20+
- PostgreSQL 14+ (local or remote). Create a database named `rcd_toll` (or any name — set `DATABASE_URL`).

## First-time setup

```bash
# 1. Server
cd server
cp .env.example .env           # edit DATABASE_URL to point to your Postgres
npm install
npm run db:migrate             # apply schema (drizzle/0000_*.sql, 0001_*.sql)
npm run db:seed                # seed zones + status_options
npm run db:import              # import 92 CSV rows and populate import_log
npm run db:create-admin -- admin "ChangeMe!2026" admin   # first admin user

# 2. Client
cd ../client
npm install
```

The admin is forced to change password on first login.

## Run

Open two terminals:

```bash
# Terminal 1 — API on :4000
cd server && npm run dev

# Terminal 2 — Vite dev server on :5173
cd client && npm run dev
```

Then visit http://localhost:5173, sign in with your admin credentials, and change the password.

## Tests

```bash
# server
cd server
npm run lint           # eslint
npx tsc --noEmit       # typecheck
npm test               # vitest unit (20 tests)
npm run test:int       # supertest integration against the running DB (10 tests)

# client
cd client
npm run build          # tsc -b + vite build
npm run e2e:install    # one-time: install Playwright chromium (~170 MB)
npm run e2e            # Playwright + axe (needs admin user from above)
```

CI (`.github/workflows/ci.yml`): lint, typecheck, gitleaks, npm audit, migrations against a disposable Postgres service container, unit + integration tests. Client job builds and audits.

## Docs

- `docs/threat-model.md` — STRIDE → control → test mapping
- `docs/architecture.md` — modules, data flow, environments
- `docs/adr/` — ADRs for auth, storage, map, CSRF, concurrency
- `docs/runbook.md` — deploy, admin user, backup/restore drill, DB GRANTs, secret rotation
- `docs/reports/` — holds per-release test/coverage/scan reports

## Verifying the import (section 2.1 acceptance test)

After `npm run db:import`, counts in `status_options`-joined queries should match:

| Field | Expected (post Change Request 01) |
|---|---|
| Civil Work: Work started | 56 |
| Civil Work: Not Feasible | 14 |
| Civil Work: Work not started | 2 |
| Civil Work: blank | 20 |
| Layout: Done | 7 |
| Layout: Not Feasible | 0 |
| Layout: In-process | 0 |
| System Integrator: RFP Floated | 78 |
| System Integrator: Not Feasible | 14 |
| Toll Notification: In-process | 10 |
| Toll Notification: Not Feasible | 14 |
| Toll Operator: RFP Floated | 78 |
| Toll Operator: Not Feasible | 14 |

`import_log` records every normalisation: `Cancelled` → `Not Feasible` (CR-01), `In Process`/`In process` → `In-process` (CR-01), latitude/longitude flagged as needing review, negative APC flags, division alias mappings.

## Open items (CONFIRM — see `../Setup.md` section 8)

These were built using the spec's proposed defaults. Changing them later means a code or data update, not a rebuild:

1. **Zone→Division mapping** is empty; the Zone filter is disabled until supplied. Insert rows into `zones.zone_id` on `divisions`.
2. **Canonical division list** uses title-casing of raw values (e.g. `jamui` → `Jamui`). The `division_aliases` table keeps the original spelling. Review and merge spelling variants (e.g. `Shergahti` vs `Sherghati`) when the canonical list is confirmed.
3. **Canonical plaza types** not yet mapped — `plaza_type` is NULL for everyone, raw text in `plaza_type_raw`.
4. **APC meaning** retained as-is; negative values flagged in `import_log` but accepted.
5. **Coordinates for 16 rows** marked `coords_need_review=true`.
6. **Auth** not implemented. All write and file routes are unauthenticated for now (Phase 7 in build order).
7. **Upload limits** set at 10 MB per file, 10 files per kind per plaza (spec default).
8. **Bihar coordinate validation** in input form: latitude 24–28, longitude 83–89 (spec default; adjust if too tight).

## API reference

All routes under `/api`. Filter query params (used by `/summary` and `/plazas`):
`zone`, `division`, `civil`, `layout`, `si`, `notification`, `operator`, `q`.
Each status filter is an id from `status_options`, or `none` for "Not updated".

| Route | Purpose |
|---|---|
| `GET /api/filters` | Zones, divisions, status options grouped by field |
| `GET /api/summary` | KPIs + the 5 status cards |
| `GET /api/plazas` | Register table rows + total count |
| `GET /api/plazas/:id` | Full plaza detail + file metadata |
| `POST /api/plazas` | Create |
| `PUT /api/plazas/:id` | Update (writes `audit_log`) |
| `POST /api/plazas/:id/files` | Upload PDF or geo_image |
| `GET /api/plazas/:id/files/:fileId` | Download one file |
| `DELETE /api/plazas/:id/files/:fileId` | Delete one file |
| `GET /api/plazas/:id/download` | Single-plaza PDF report |
| `GET /api/plazas/:id/download-all` | ZIP: report + all attachments |

## Design

Per spec section 7: Barlow + Barlow Semi Condensed fonts, solid saturated status pills with white text, no light shades. Palette set via Tailwind config in `client/tailwind.config.js`. Dark theme toggle in the header.
