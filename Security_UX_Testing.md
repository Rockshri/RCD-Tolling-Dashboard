# RCD Toll Plaza Monitor: Security, UX and Testing Brief

Companion to `CLAUDE.md` (the functional build spec). `CLAUDE.md` says **what** to build. This file says **how well** it must be built: secure by design, visually interactive, and fully tested.

Stack: React + Tailwind, Node.js + Express, PostgreSQL, Drizzle ORM.

---

## 0. How to use this file

1. Read `CLAUDE.md` first. Where the two files disagree, ask the user; do not pick silently.
2. Do not invent requirements, numbers or compliance claims. Anything marked **CONFIRM** is a proposal that needs the user's answer before it is built.
3. Targets marked **(placeholder)** are starting values, not agreed requirements.
4. Work in the order in section 6. Security foundations (authentication, roles) come before the input form and file upload are enabled.
5. Do not claim a test, scan or audit was done unless it was actually run and its output is saved in the repository (`docs/reports/`).
6. "All testing methodologies" is read as: every methodology that applies to this system, each mapped in section 4.1, with the ones that need people (user acceptance, usability, third-party penetration test) listed separately because Claude Code cannot perform them alone.

---

## 1. Roles to apply

Apply these four viewpoints on every task, in this order of priority when they conflict: security, then correctness, then UX, then convenience.

| Role | Responsible for | Section |
|---|---|---|
| System design expert | Architecture, trust boundaries, data flow, non-functional requirements, environments, CI/CD | 2.1, 2.4, 2.6 |
| Software security expert | Threat model, authentication, authorisation, upload safety, hardening, audit trail | 2.2 to 2.5 |
| Web designer expert | Visual design, interaction, accessibility, responsive layout, microcopy | 3 |
| PERN developer expert | Clean implementation, tests, maintainability, performance | all |

---

## 2. Task A: Secure the dashboard through proper system design

### 2.1 Target architecture (proposed, CONFIRM hosting first)

```
Browser (React SPA)
   │  HTTPS only
   ▼
Reverse proxy / load balancer   TLS termination, HSTS, request size limits, rate limits
   │
   ▼
Express API (modular monolith)  auth, RBAC, validation, business rules, audit
   │            │
   │            └──► File storage (private, outside web root)   PDFs, geolocation images
   ▼
PostgreSQL (private network)    Drizzle ORM, least-privilege roles
```

Design decisions:
- **Modular monolith, not microservices.** The data set is small (92 plazas today). Keep one Express app with clear modules: `auth`, `plazas`, `files`, `reports`, `admin`.
- **Same-origin deployment** (SPA and API under one domain) so cookies, CORS and CSP stay simple.
- **Private database.** Postgres accepts connections only from the API host or private network.
- **Files are never served directly.** They are read through an authenticated API route (see 2.3.5).
- **Optional components** (CONFIRM): antivirus scanning for uploads, object storage instead of local disk, a map tile provider.

#### Trust boundaries and data classes

| Data | Where | Sensitivity (CONFIRM with user) |
|---|---|---|
| Plaza, road, status, length data | `toll_plazas` and related tables | Internal government data. Classification not stated |
| User accounts, password hashes, sessions | auth tables (to be added) | Confidential |
| Uploaded PDFs and geolocation images | file storage + `plaza_files` | Internal. Images may contain GPS coordinates |
| Audit and import logs | `audit_log`, `import_log` | Internal, must not be editable by app users |
| Secrets (DB password, session secret) | environment / secret store | Secret |

### 2.2 Threat model (project-specific)

Produce `docs/threat-model.md` from this table and keep it updated.

| # | Threat (STRIDE) | Where it applies here | Required control |
|---|---|---|---|
| T1 | Spoofing: stolen or guessed login | Login, sessions | Strong password hashing, lockout/rate limit, secure cookies, optional MFA (CONFIRM) |
| T2 | Broken access control | Edit plaza, delete file, download file | Server-side role and division checks on every route; deny by default |
| T3 | IDOR | `/plazas/:id/files/:fileId` | Check that the file belongs to the plaza **and** the user may see that plaza |
| T4 | Malicious upload | PDF and image upload | Type check by content, size limits, random storage names, no execution, no inline rendering |
| T5 | Injection | Search box `q`, filter params, import | Drizzle parameterised queries only; validate every param; never concatenate user input into `sql` |
| T6 | Stored XSS | Plaza name, road name, village, file names | React escapes by default; ban `dangerouslySetInnerHTML`; strict CSP |
| T7 | CSRF | All state-changing routes | `SameSite` cookies plus a CSRF token on `POST/PUT/PATCH/DELETE` |
| T8 | Spreadsheet formula injection | Any CSV/Excel download | Prefix cells starting with `=`, `+`, `-`, `@` with `'` |
| T9 | Malicious or oversized Excel import | Admin import script | Admin-only, read values not formulas, size limit, run offline from the web app |
| T10 | Information disclosure | Error messages, logs, file paths, EXIF | Generic errors to clients, no stack traces, no secrets or file paths in responses or logs |
| T11 | Denial of service | Upload, search, summary | Rate limits, body size limits, pagination caps, DB statement timeout |
| T12 | Tampering with history | Audit log | Append-only; the app database role has no UPDATE/DELETE on `audit_log` |
| T13 | Supply-chain attack | npm dependencies | Lockfile, audit in CI, pinned versions, review new packages |
| T14 | Data loss | Database, uploaded files | Backups with tested restore (2.5) |

### 2.3 Security controls (build all of these)

#### 2.3.1 Authentication
- Passwords hashed with a modern slow hash (argon2id suggested; bcrypt acceptable). Never store or log plaintext.
- **Session design (proposed, CONFIRM):** server-side sessions stored in Postgres, delivered in an `HttpOnly; Secure; SameSite=Lax` (or `Strict`) cookie. Avoid putting tokens in `localStorage`. Rotate the session id on login, destroy it on logout, set an idle and an absolute timeout (placeholder: 30 minutes idle, 12 hours absolute).
- Login rate limit per account and per IP, with temporary lockout and generic error text ("Invalid username or password").
- Password rules: minimum length, a check against common passwords; no forced periodic rotation unless the user requires it.
- Optional (CONFIRM): one-time-password MFA, or integration with an existing government single sign-on. Ask before building either.
- Account lifecycle: admin creates users, forced password change at first login, disable instead of delete.

#### 2.3.2 Authorisation (RBAC with division scope)
Proposed roles (CONFIRM the list and who gets what):

| Capability | Viewer | Division officer | Editor | Admin |
|---|---|---|---|---|
| View dashboard, plazas, files | yes | yes | yes | yes |
| Download details PDF and files | yes | yes | yes | yes |
| Create or edit plaza | no | own division only | all | all |
| Upload or delete files | no | own division only | all | all |
| Manage users, status vocabularies, zones | no | no | no | yes |
| View audit log | no | no | no | yes |

- Enforce on the **server** in a single `authorize(action, resource)` function used by every route. The UI hides buttons for convenience only.
- Deny by default. A route with no declared permission must fail a test.
- Optional defence in depth (CONFIRM): PostgreSQL row-level security for division scope.

#### 2.3.3 API hardening
- `helmet` (or equivalent) security headers; `X-Content-Type-Options: nosniff`; `Referrer-Policy`; `frame-ancestors 'none'`.
- **CORS:** same-origin by default. If a separate origin is unavoidable, use an exact allow-list; never `*` with credentials.
- Validate every body, query string and route param with a schema library (zod). Reject unknown fields. Cap `pageSize`.
- JSON body limit small by default; larger only on the upload route.
- Central error handler: log details server-side with a request id, return a generic message and the request id to the client.
- Rate limits: strict on login and upload, moderate on read routes.
- Database `statement_timeout` and a connection pool limit.
- All SQL through Drizzle. Where `sql` is used, interpolate only Drizzle columns and bound values, never raw user strings. Escape `%` and `_` in the search term before building `ilike` patterns.

#### 2.3.4 Frontend hardening
- **Content Security Policy** with no `unsafe-inline` or `unsafe-eval` for scripts. Self-host fonts (Barlow, Barlow Semi Condensed) instead of loading them from Google, so the CSP can stay `default-src 'self'`. This is a change from the prototype, which loaded Google Fonts.
- No `dangerouslySetInnerHTML`. No user-controlled URLs in `href` or `src` without an allow-list of schemes.
- No secrets in the client bundle; only public configuration.
- Show a session-expired message and return to login without losing unsaved form input where possible.

#### 2.3.5 File upload and download security (PDF and geolocation image)
- Allowed types only: `application/pdf`, `image/jpeg`, `image/png` (CONFIRM list). No SVG, no HTML, no archives.
- Verify the type by **file content** (magic bytes), not the extension or the browser-reported type. Re-check the extension matches.
- Enforce size and count limits on the server (placeholder: 10 MB per file, 10 files per type per plaza; CONFIRM).
- Store under a random key (UUID) in a private directory or bucket outside the web root. Never use the user's filename as a path. Keep the original name only as metadata, sanitised.
- Serve through `GET /plazas/:id/files/:fileId` after an authorisation check, with `Content-Disposition: attachment`, the stored content type, and `X-Content-Type-Options: nosniff`. Do not render uploaded PDFs inline in the app origin.
- Images: re-encode or at least validate dimensions to reject decompression bombs. Read EXIF GPS only to display it for comparison with the entered coordinates (CONFIRM, see `CLAUDE.md` 4.2.1); do not auto-overwrite coordinates. Decide whether to strip other EXIF fields from stored copies.
- Antivirus scan before a file becomes downloadable (CONFIRM whether a scanner is available).
- Downloaded ZIP (`download-all`): build it from database-listed files only; never from user-supplied paths; protect against path traversal in entry names.
- Delete removes both the database row and the stored file, and writes an audit entry.

#### 2.3.6 Database security
- Two database roles: `migrator` (DDL, used only by `drizzle-kit migrate`) and `app` (SELECT/INSERT/UPDATE/DELETE on needed tables only, INSERT-only on `audit_log`).
- TLS between API and database if they are on different hosts. Encryption at rest through the host or disk (CONFIRM).
- No default credentials; unique password per environment.
- Migrations are reviewed SQL files committed to the repository; no schema changes by hand in production.

#### 2.3.7 Secrets and configuration
- Secrets only in environment variables or a secret manager. Commit `.env.example` with names and no values. Add secret scanning to CI.
- Separate configuration and credentials for development, staging and production.

#### 2.3.8 Logging, audit and monitoring
- Audit trail (who, what, when, old value, new value) for plaza edits, status changes, file upload/delete/download, logins, failed logins, role changes, exports.
- Structured JSON logs with request id. Never log passwords, session ids, tokens or full file contents.
- Health endpoint (`/healthz`) with no sensitive output. Alerts on repeated login failures and 5xx spikes (CONFIRM tooling).
- Retention period for logs and audit data: CONFIRM.

#### 2.3.9 Dependencies and build
- Commit the lockfile. Run `npm audit` (or an equivalent) in CI and fail on high or critical findings that have a fix.
- Enable automated dependency update pull requests. Keep the dependency list small.
- Generate a software bill of materials at release (suggested).

### 2.4 Non-functional requirements (placeholders, CONFIRM)

| Area | Placeholder target |
|---|---|
| Users | Unknown. Ask for expected users and peak concurrency before load testing |
| API response time (summary, plazas) | p95 under 300 ms at the data size of section 1 of `CLAUDE.md` |
| Page load on a mid-range phone, mobile network | Usable within about 3 seconds |
| Availability | Ask the user (office hours only or 24x7) |
| Backup | Daily database backup; recovery point and recovery time targets to be agreed |
| Data growth | Small today (92 rows); design for thousands without a redesign, using the existing indexes and pagination |

### 2.5 Backup, recovery and operations
- Automated database backups and a backup of the file storage. **Restore must be tested**, not assumed; record the result.
- Runbook `docs/runbook.md`: deploy, roll back a migration, rotate secrets, restore from backup, add or disable a user.
- Environments: development, staging (mirror of production, with test data), production. Production data never goes into development.

### 2.6 CI/CD with security gates (proposed)

Pipeline stages, each blocking the next on failure:
1. Install with the lockfile, then lint and typecheck.
2. Unit tests.
3. Secret scan and static security analysis (SAST).
4. Dependency audit.
5. Build, then apply migrations to a throwaway database.
6. Integration and API tests against that database.
7. End-to-end, accessibility and visual tests.
8. Dynamic scan (DAST) against staging.
9. Manual approval, then deploy.

### 2.7 Security definition of done
- [ ] Threat model written and each row of 2.2 mapped to a control and a test
- [ ] Every route has an explicit permission; an unauthenticated request to any non-public route returns 401
- [ ] Cross-division edit and file access are denied in tests
- [ ] Upload abuse cases in 4.3 all rejected
- [ ] CSP active with no `unsafe-inline`/`unsafe-eval` for scripts
- [ ] No high or critical open findings from SAST, dependency audit, DAST
- [ ] Secrets absent from the repository (scan result saved)
- [ ] Backup restore tested and recorded
- [ ] Independent penetration test arranged by the user before go-live (Claude Code cannot do this)

---

## 3. Task B: Visual appeal and interactivity

### 3.1 Design principles (carried over from the user's feedback)
- Strong, solid colours; **no light or pale shades** for status; bigger fonts; numbers must be large and clear.
- Fonts: Barlow (body) and Barlow Semi Condensed (headings and all numbers), tabular figures. Self-hosted (see 2.3.4).
- The table must never overflow horizontally; below 1020px rows become labelled cards.
- Light and dark themes. Palette and tokens as in `CLAUDE.md` section 7; define them once as Tailwind theme values backed by CSS variables.
- Status is never shown by colour alone: every pill carries its text label; add a small icon per tone.
- The five status cards must fit cleanly: 5 across on wide screens, 2 to 3 on tablet, 1 on phone.

### 3.2 Interactive features (build; each uses only data that exists)

**Dashboard**
1. **Animated KPI numbers** that count up on first load and tween when filters change. Respect `prefers-reduced-motion` (no animation then).
2. **Status cards**: proportional bar with hover tooltip (count and percentage), click to filter, active status highlighted.
3. **Active-filter chips** under the filter bar, each removable, plus "Clear all". Filter state lives in the URL (see `CLAUDE.md` 4.1.1).
4. **Charts from real fields only:** plazas per division (stacked by Civil Work status), a pipeline view of the four stages (Civil Work, Layout, System Integrator, Toll Notification), and plaza type mix. Every chart segment is clickable and sets the matching filter. Charts need a data table alternative for screen readers.
5. **Map view** of plazas using latitude/longitude, colour-coded by a chosen status; rows with missing coordinates are listed as "coordinates need review". Optional, CONFIRM: a map needs a tile provider, which affects the CSP and offline use.
6. **Loading, empty and error states** designed for every panel: skeleton shapes on first load, previous numbers kept while refreshing, a clear empty state with a "Clear all" action, a retry on error.
7. **Table**: sticky header, sortable columns, row hover, keyboard row selection, density toggle (comfortable/compact), "Export visible rows" (CONFIRM format; apply the spreadsheet-injection rule from T8).

**Details modal** (centred dialog — renamed from "drawer" by Change Request 01)
8. Tabs: **Details**, **Status**, **Files**, **History**. History is built from `audit_log`, shown as a timeline once real edits exist; do not fabricate history.
9. Geolocation images in a gallery with a full-screen viewer (keyboard arrows, Esc). Show EXIF GPS next to the entered coordinates when present.
10. Download menu: details PDF, single files, all as ZIP (see `CLAUDE.md` 4.3).
11. Smooth open and close transition (fade+scale); focus moves into the modal and returns to the clicked row on close; Esc / × / backdrop click all close it; phone widths fill the screen.

**Input form**
12. Sectioned form with a sticky section navigator and progress indicator.
13. Calculated fields (totals and Equivalent Length) update live and are clearly read-only.
14. Inline validation with plain messages; save disabled until valid; an "unsaved changes" guard on leaving.
15. Drag-and-drop upload zones for PDF and image with progress bars, previews, size and type errors shown before upload starts, and an in-page confirmation for delete.
16. Optional (CONFIRM): pick coordinates on a map; capture a photo on a phone camera for the geolocation image.

### 3.3 Accessibility and usability (placeholder target: WCAG 2.1 AA, CONFIRM)
- Contrast at least 4.5:1 for text, 3:1 for large text and UI parts, in **both** themes.
- Full keyboard use; visible focus ring; logical tab order; focus trap inside the drawer and dialogs.
- Labels on every control; `aria-live` announcements when KPI numbers update; semantic table markup (and card layout on mobile that keeps labels).
- Touch targets at least 44px on phones.
- Language: English only, or English and Hindi labels (CONFIRM). Build text through a translation layer from the start if Hindi may be needed.
- Plain microcopy: buttons say what they do ("Save plaza", "Upload PDF"); errors say what went wrong and how to fix it.

### 3.4 Performance budget (placeholders)
- Code-split by route; lazy-load charts, map and PDF/ZIP features.
- Debounce search (about 300 ms); paginate the table; cancel superseded requests.
- Largest content paint within about 2.5 seconds on a mid-range phone; no layout shift when data arrives (reserve space for cards and charts).

### 3.5 UX definition of done
- [ ] Checked at 360, 768 and 1280 px, light and dark, with no horizontal page scroll
- [ ] Every interactive element reachable and usable by keyboard
- [ ] Automated accessibility scan clean; manual screen-reader pass on dashboard, drawer and form
- [ ] Loading, empty and error states exist for every data panel
- [ ] Reduced-motion setting respected
- [ ] The user has reviewed the design on a real screen and approved or listed changes

---

## 4. Task C: Testing (all applicable methodologies)

### 4.1 Methodology matrix

| # | Methodology | What it covers here | Suggested tools | Runs |
|---|---|---|---|---|
| 1 | Static analysis | Lint, typecheck, formatting, dead code | ESLint, TypeScript, Prettier | Every commit |
| 2 | Secret scanning | Keys or passwords in code or history | gitleaks | Every commit |
| 3 | Unit testing | `buildWhere`, calculated-length formulas, chainage parser, division/type cleaning, authorisation function, validators | Vitest or Jest | Every commit |
| 4 | Integration testing | API routes against a real PostgreSQL with real migrations (Drizzle) | Supertest + a disposable Postgres (container or test database) | Every pull request |
| 5 | Database and migration testing | Migrations apply from empty; generated columns correct; constraints; rollback plan | `drizzle-kit` + SQL assertions | Every pull request |
| 6 | Data validation / ETL testing | Import of the 92-row file: counts, cleaning rules, `import_log` entries | Script + assertions | Every pull request |
| 7 | API and contract testing | Request/response shapes, status codes, error format, unknown-parameter rejection | Supertest, schema checks | Every pull request |
| 8 | Component testing | Filter bar, KPI strip, status cards, table, drawer, form, uploader | React Testing Library | Every pull request |
| 9 | End-to-end (system) testing | Real browser flows: filter, drill down, edit, upload, download | Playwright | Every pull request (core), nightly (full) |
| 10 | Regression testing | Re-run of the full automated suite; bug fixes get a test first | CI | Every pull request |
| 11 | Smoke and sanity testing | App starts, login works, dashboard loads, key numbers present | Playwright subset | After every deploy |
| 12 | Security testing: static | Code patterns, injection, unsafe APIs | Semgrep or similar | Every pull request |
| 13 | Security testing: dependency | Known vulnerable packages | `npm audit` or similar | Every pull request and weekly |
| 14 | Security testing: dynamic | Running app scan against staging | OWASP ZAP | Before each release |
| 15 | Authorisation / access-control testing | Role and division matrix, IDOR, unauthenticated access | Supertest | Every pull request |
| 16 | File-upload testing | Abuse cases in 4.3 | Supertest + fixtures | Every pull request |
| 17 | Penetration testing | Independent attack simulation | Third-party tester, arranged by the user | Before go-live |
| 18 | Performance and load testing | Summary and list under concurrent users; upload under load | k6 or autocannon | Before release |
| 19 | Stress and soak testing | Behaviour beyond expected load and over hours | k6 | Before go-live |
| 20 | Accessibility testing | WCAG checks | axe via Playwright, plus manual screen-reader pass | Every pull request (automated) |
| 21 | Visual regression testing | Unintended UI changes in light/dark, 3 widths | Playwright screenshots | Every pull request |
| 22 | Cross-browser and device testing | Supported browsers and phones (list from user, CONFIRM) | Playwright browsers, real devices | Before release |
| 23 | Responsive / layout testing | No horizontal overflow at 360, 768, 1280 px | Playwright assertions | Every pull request |
| 24 | Usability testing | Real officers completing real tasks | Moderated sessions, task script | Before go-live (people needed) |
| 25 | User acceptance testing (UAT) | RCD signs off the scenarios in 4.5 | Written scripts | Before go-live (people needed) |
| 26 | Exploratory testing | Unscripted probing by a tester | Charter-based notes | Each release |
| 27 | Compatibility / data-migration testing | Re-import of future spreadsheets with new spellings | Fixtures | When the sheet format changes |
| 28 | Concurrency testing | Two editors save the same plaza; last-write-wins vs conflict warning (CONFIRM approach, optimistic check on `updatedAt` suggested) | Integration test | Every pull request |
| 29 | Resilience / failure testing | Database down, storage full, slow upload, expired session | Integration + manual | Before go-live |
| 30 | Backup and restore testing | Restore database and files to a clean machine | Runbook drill | Before go-live, then quarterly |
| 31 | Localisation testing | Only if Hindi is required (CONFIRM) | Playwright | If applicable |
| 32 | Mutation testing (optional) | Strength of the unit tests on authorisation and filters | Stryker | Occasionally |

Not every row can be done by Claude Code alone: rows 17, 22 (real devices), 24, 25, 26 and part of 29 and 30 need people. List them in the release checklist as the user's responsibility.

### 4.2 Test data
- Base fixture: the 92-row `toll_plazas_seed_raw.csv`. Add small synthetic fixtures for edge cases (blank chainage, `Cancelled` chainage, missing coordinates, negative APC, odd spellings).
- Never use real passwords or personal data in tests. Test users are created by the test setup.
- Tests must create and clean their own data and be runnable in any order.

### 4.3 Required test cases (starting set; extend as features grow)

**Data and calculations**
- Import loads 92 plazas; status counts equal the (post Change Request 01) table in `Setup.md` 2.1 — Civil Work: 56 Work started, 14 Not Feasible, 2 Work not started, 20 blank; Layout: 7 Done, 0 Not Feasible, 0 In-process, 85 blank; System Integrator: 78 RFP Floated, 14 Not Feasible; Toll Notification: 10 In-process, 14 Not Feasible, 68 blank; Toll Operator: 78 RFP Floated, 14 Not Feasible.
- 34 bridge entries and 58 road entries; 14 Not Feasible.
- Formula checks against the workbook: S. No 1 (road ≥4 lane 16.6, structure ≥4 lane 4.4) gives total road 16.6, total structure 4.4, total length 21 and Equivalent Length 60.6. S. No 91 (road 2 lane 31.025, structure 2 lane 0.297) gives total length 31.322 and Equivalent Length 33.995.
- Two rows with a trailing `S` in the coordinates are flagged for review, not guessed.

**Filters and KPIs (the core invariant)**
- For **every** combination of the seven filters in a generated test matrix: card totals = `kpis.plazas` = `/plazas` `total`.
- Each card's per-status counts sum to its total; the "Not updated" bucket equals the blank count.
- Zone filter narrows the Division list; changing Zone clears a Division outside it.
- URL query string restores the same filter state on reload.
- Search with `%`, `_`, quotes, `'; drop table`, very long strings, and Unicode returns safely with correct matches.

**Security**
- Unauthenticated request to each protected route returns 401; wrong role returns 403.
- Division officer cannot edit or download files of another division (IDOR test using ids from another division).
- State-changing request without a valid CSRF token is rejected.
- Login: lockout after repeated failures; generic error text; session id changes after login; logout invalidates the session; cookie flags (`HttpOnly`, `Secure`, `SameSite`) present.
- Stored XSS: plaza name `<img src=x onerror=...>` renders as text everywhere, including the PDF report.
- Export: a cell value starting with `=` is neutralised.
- Response headers include CSP, `nosniff`, `frame-ancestors`; no stack trace or file path appears in any error body.

**File upload**
- Reject: wrong type, `.pdf` that is really an executable, `.jpg` that is really HTML, SVG, zero-byte file, file over the size limit, too many files, filename with `../`, double extension, very long filename, null byte in name.
- Accept: valid PDF, valid JPEG with and without EXIF GPS, valid PNG.
- A file URL for plaza A is not downloadable by a user without access to plaza A, and not by an unauthenticated request.
- Delete removes the stored file and the row, and writes an audit entry.
- ZIP download contains only that plaza's files, with safe entry names.

**UI**
- Five status cards render with counts for the current filters; clicking a status sets the filter and the chip appears.
- No horizontal scroll at 360, 768 and 1280 px in both themes; table becomes cards at 1020px and below.
- Drawer: opens from a row, traps focus, closes with Esc and returns focus.
- Form: calculated fields update live; invalid input blocks save; unsaved-changes guard works.
- Reduced-motion setting disables the count-up animation.

### 4.4 Coverage and quality gates (placeholders, CONFIRM)
- Unit and integration coverage: at least 80 percent of server lines, and 100 percent of branches in the authorisation function and `buildWhere`.
- Zero failing tests; zero lint or type errors.
- Zero open critical or high security findings; medium findings need a written decision.
- Zero critical accessibility violations from the automated scan.
- Defect severity scale for triage: critical (data loss, security breach, app unusable), high (core feature broken, no workaround), medium (feature degraded, workaround exists), low (cosmetic).

### 4.5 User acceptance scenarios (for RCD to run)
1. Open the dashboard; read the five status cards and the KPIs for all plazas.
2. Filter by one division and one Civil Work status; confirm the KPIs, cards and table agree with the register.
3. Open a plaza; read all details; download the details PDF.
4. As an authorised user, edit a plaza's statuses and save; check the change appears and the history shows it.
5. Upload a PDF and a geolocation photo to a plaza; download both.
6. As a user without permission, try to edit or upload; confirm it is refused.
7. Open the dashboard on a phone; confirm it is readable and nothing scrolls sideways.

### 4.6 Reports to save in the repository
`docs/reports/` holds, per release: test run summary, coverage report, SAST and dependency audit output, DAST report, accessibility report, performance results, backup restore record, and a list of known issues with severity.

---

## 5. Deliverables checklist

- [ ] `docs/threat-model.md`
- [ ] `docs/architecture.md` (diagram from 2.1, decisions, environments)
- [ ] `docs/adr/` short decision records for: session vs token auth, file storage, map provider, CSRF approach, concurrency approach
- [ ] `docs/runbook.md`
- [ ] `docs/reports/` (4.6)
- [ ] `.env.example`, CI pipeline file with the gates in 2.6
- [ ] Design tokens in the Tailwind config and a short component guide
- [ ] Test suites for every row of 4.1 that Claude Code can automate

---

## 6. Phased plan

| Phase | Work | Exit condition |
|---|---|---|
| 1. Foundations | Scaffold, Drizzle schema and migrations, CI with lint, typecheck, secret scan, audit; threat model draft | CI green on an empty app |
| 2. Auth and RBAC | Users, sessions, roles, division scope, audit log, security headers, rate limits | Authorisation tests (4.3) pass |
| 3. Read-only dashboard | Seven filters, dynamic KPIs, five cards, table, drawer, charts | Filter invariants pass; UI definition of done (3.5) for the dashboard |
| 4. Input form | Form, calculated fields, validation, audit, concurrency handling | Form and data tests pass |
| 5. Files and downloads | Uploads with all 2.3.5 controls, downloads, ZIP, PDF report | All upload abuse cases rejected |
| 6. Hardening and non-functional | DAST, load and stress, resilience, backup restore drill, accessibility pass | Section 2.7 and 4.4 gates met |
| 7. Acceptance | UAT, usability sessions, penetration test, fixes | User sign-off |

---

## 7. Open questions (ask the user before the dependent work)

1. Where will it be hosted: public internet, or inside a government network or VPN? Who manages the server?
2. Login method: own username and password, one-time-password MFA, or an existing government single sign-on?
3. The roles and permissions in 2.3.2. Can division officers edit only their own division?
4. Data classification: is the plaza data public, internal or restricted? Is any government security audit or empanelled-auditor review required before go-live?
5. Expected number of users and peak concurrent users (needed for load targets).
6. Required availability, backup frequency, and recovery targets.
7. Retention period for logs, audit data and uploaded files.
8. Antivirus scanning and object storage: available or not?
9. Map view: allowed to load map tiles from an external provider? Offline use needed?
10. Languages: English only, or English and Hindi?
11. Accessibility target (WCAG 2.1 AA assumed) and browsers/devices that must be supported.
12. Will field officers use phones to capture the geolocation photo and fill the form?
13. Concurrent edits: show a conflict warning (suggested) or last save wins?
14. Export formats wanted for the register and the plaza details (PDF, Excel, CSV).
15. Who will arrange the independent penetration test and the UAT, and when?