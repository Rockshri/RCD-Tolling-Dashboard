# Change Request 01: Dashboard UI and Label Updates

Companion to `CLAUDE.md` (functional build spec) and `SECURITY_UX_TESTING.md` (security, UX, testing brief). This file lists seven changes requested by the user. Where it conflicts with those files on these seven points, **this file wins**. Section 9 lists which parts of the other files it changes.

Stack: React + Tailwind, Node.js + Express, PostgreSQL, Drizzle ORM.

---

## 0. Rules for Claude Code

1. Do only what is listed here. Do not redesign anything else.
2. Do not invent data, labels or behaviour. Anything marked **CONFIRM** is a proposal; ask the user before building it, or build the stated default and flag it.
3. Do not run a blind find-and-replace of the word "Cancel". Action buttons such as "Cancel" in the input form (discard edits) are not statuses and stay as they are.
4. Use one central file of labels (section 8) so a short or old label cannot reappear in one component.
5. Keep the visual rules from earlier feedback: solid colours, no light shades, bigger fonts, clear numbers.

---

## 1. Summary

| # | Change | Area | Needs confirmation |
|---|---|---|---|
| 1 | Rename column "Name of Toll Plaza" to "Toll Plaza Code" | Table, search, form, modal title | Yes (what happens to the plaza name field) |
| 2 | Open the right-side pop-out in the centre of the screen | Details view | Small (mobile behaviour) |
| 3 | Show each status next to its status field name in the pop-out | Details view | No |
| 4 | Fix the table header while scrolling down | Table | No |
| 5 | Replace "Cancelled" with "Not Feasible" everywhere a status shows it | Filters, cards, table, pop-out, KPIs, exports, data | Yes (chainage text, KPI colour) |
| 6 | Layout filter options: 1. Done, 2. Not Feasible, 3. In-process | Filter, cards, form, database | Yes ("Not updated", existing data) |
| 7 | Use the full status field names everywhere | Table, cards, filters, pop-out, form, exports | No (scope confirmed by the user) |

Suggested order of work: 5, 6 and 7 first (labels and vocabulary), then 1 and 4 (table), then 2 and 3 (pop-out), then tests (section 10).

---

## 2. Change 1: "Name of Toll Plaza" becomes "Toll Plaza Code"

**Request:** "Rename the Name of Toll Plaza column to Toll Plaza code."

**Today:** The first table column is "Name of Toll Plaza". The source workbook has no plaza name; it has a "Toll Plaza Code" column that is **blank for all 92 rows**.

**Required:**
- The first table column header reads **Toll Plaza Code** and shows the `plaza_code` field.
- Because every code is blank today, show **Not assigned** in the cell (solid dark text, not light grey). Never generate or guess a code.
- Same rename in: the mobile card label, the sort key, the search (search also matches the code), the filter chips if shown, exports and the details PDF.
- The pop-out title shows the code when present. When the code is blank, the title is the **Name of Road**, with a line "Toll Plaza Code: Not assigned".
- Input form: **Toll Plaza Code** is the first field in the Identification section.
- Remove the "demo" tag and any generated plaza names. They belonged to the prototype only.

**How (Drizzle, API):** `plaza_code` already exists in `toll_plazas`. No schema change for the rename.

**Acceptance:**
- [ ] No table, card, form or export shows the text "Name of Toll Plaza" as a column
- [ ] With the 92-row seed, the code column shows "Not assigned" for all rows
- [ ] Typing a code in the form saves it, and the table and pop-out then show it
- [ ] Sorting by the code column works

**CONFIRM:**
- (a) Keep the `plaza_name` field in the database and the form (default: keep it, hidden from the table), or remove it?
- (b) Code format and uniqueness. Until the user gives the format, do not add a unique constraint. When confirmed, add a partial unique index on `plaza_code` where it is not null.

---

## 3. Change 2: Details pop-out opens in the centre of the screen

**Request:** "Right side pop out should open center of the screen."

**Today:** Clicking a row opens a panel that slides in from the right edge (full height, about 460 px wide).

**Required:** a **centred modal dialog**.
- Centred horizontally and vertically over a dimmed backdrop.
- Width: up to 720 px (placeholder), never wider than the screen minus 32 px. Height: up to 90 percent of the screen height. The body scrolls inside; the title bar and the action bar (Edit, Download) stay visible.
- Opens with a short fade and scale (about 150 to 200 ms). No animation when the user's system asks for reduced motion.
- Closes with the × button, the Esc key and a click on the backdrop. Focus moves into the dialog on open, is kept inside it, and returns to the clicked row on close. The page behind does not scroll while the dialog is open.
- Accessibility: `role="dialog"`, `aria-modal="true"`, title linked with `aria-labelledby`. The native HTML `<dialog>` element with `showModal()` is a good way to get the focus trap and Esc handling; any equivalent is fine.
- Same content as before (Location, Road and Plaza, Status, Attachments, Edit and Download), with the Status section changed as in Change 3.
- Deep link `/plazas/:id` opens the same modal over the dashboard.
- Phone width (640 px and below): the modal fills the screen (default; **CONFIRM**), with the same close behaviour.

**How:** rename the component `PlazaDrawer` to `PlazaDetailModal` everywhere (code, tests, docs). Remove the slide-from-right styles.

**Acceptance:**
- [ ] At 1280 px, the modal is centred (equal left and right gaps, equal top and bottom gaps when shorter than the screen)
- [ ] Long content scrolls inside the modal; title and action bars stay visible
- [ ] Esc, × and backdrop click all close it; focus returns to the clicked row
- [ ] Keyboard Tab never leaves the modal while it is open
- [ ] No horizontal scroll inside the modal at 360 px

---

## 4. Change 3: Status section lists each status with its field name

**Request:** "In the pop out > In status section, mention the status with their respective status field."

**Today:** Four small boxes in a 2 by 2 grid, each with a tiny uppercase caption above the status pill. The toll operator is a separate line below.

**Required:** a clear list of **five rows**, one per status field, in this fixed order. Each row shows the full field name on the left and the status on the right.

| Row | Field name (left) | Value (right) |
|---|---|---|
| 1 | Status of Civil Work | status pill |
| 2 | Status of Layout | status pill |
| 3 | Status of System Integrator | status pill |
| 4 | Status of Toll Notification | status pill |
| 5 | Name of Toll Operator | status pill |

- Field names: at least 14 px, bold, dark text. Not a small caption, not light grey.
- Status pill: solid colour, white text, full label (for example "Work started", "Done", "Not Feasible"). A blank value shows a grey solid pill reading **Not updated**.
- Use the central labels from section 8. Rows stack on phone widths.

**Acceptance:**
- [ ] For any plaza, the Status section shows exactly five rows with the names above
- [ ] The value beside each name matches the table row for that plaza
- [ ] A plaza with blank values shows "Not updated" for those rows

---

## 5. Change 4: Table header stays fixed while scrolling down

**Request:** "Header of the table should be fixed on scrolling down the screen."

**Today:** The header row is marked sticky, but the table sits inside a horizontally scrollable wrapper (`overflow-x: auto`). A sticky element then sticks to that wrapper, not to the page, so the header scrolls away with the page.

**Required:**
- When the page scrolls down through the 92 rows, the column header row stays visible at the top, directly **below** the fixed page header, with no gap and no overlap.
- Recommended build (default): remove the overflow wrapper (the table already fits at desktop widths) and set the header cells to `position: sticky; top: var(--app-header-height)`. Define `--app-header-height` once from the real height of the page header.
- Alternative if a wrapper is unavoidable: give the table area its own vertical scroll (`max-height` of the screen minus the headers, `overflow-y: auto`) and make the header sticky at `top: 0` inside it.
- Use `border-separate border-spacing-0` on the table. With collapsed borders the header borders do not travel with a sticky header.
- Header cells have a solid background (dark teal, as now), sit above the rows (`z-index`), and show a thin shadow or bottom border while stuck.
- Column widths stay aligned with the data columns. Sorting still works while the header is stuck.
- Below 1020 px the table becomes cards and has no header row; nothing sticky is needed there.

**Acceptance (Playwright):**
- [ ] After scrolling down 1,000 px at 1280 px and at 1100 px, the header row's top edge equals the bottom edge of the page header
- [ ] Header is visible, solid, and readable in light and dark themes
- [ ] Clicking a header cell while stuck sorts the table
- [ ] Opening and closing the modal does not change the header position

---

## 6. Change 5: "Cancelled" becomes "Not Feasible"

**Request:** "Replace the 'Cancel' option to 'Not Feasible' of the filter in the Dashboard and everywhere where status is 'cancel' visible to 'Not Feasible'."

**Today:** The workbook holds the value `Cancelled` in 14 rows for Civil Work, System Integrator, Toll Notification and Toll Operator. The spec shows it as is, and the KPI strip has a "Cancelled" card.

**Required:** the visible label is exactly **Not Feasible** (capital N, capital F, one space) everywhere a status shows it:

| Place | Change |
|---|---|
| Filter dropdowns (Civil Work, System Integrator, Toll Notification, Name of Toll Operator) | option "Cancelled" becomes "Not Feasible" |
| Status cards (five) | row label and tooltip |
| Table pills | label |
| Details modal, Status section | label |
| KPI strip | the "Cancelled" KPI is renamed **Not Feasible**; it keeps counting plazas whose Civil Work status is Not Feasible |
| Filter chips, chart legends, tooltips, empty-state text | label |
| Input form dropdowns | label |
| Details PDF, ZIP report, CSV/Excel exports, audit history text | label |
| Chainage cell | the 14 rows whose chainage text is `Cancelled` show **Not Feasible** (default; **CONFIRM**) |

**Data and code (Drizzle):**
- Keep the source Excel file untouched. The import script maps the raw value `Cancelled` to the `Not Feasible` status option and records each mapping in `import_log`.
- In `status_options`, the label is `Not Feasible` for the four fields above.
- Rename the tone value `cancelled` to `not_feasible` in `statusToneEnum`. Rename code identifiers to match: `kpis.cancelled` becomes `kpis.notFeasible`; any `is_cancelled` flag becomes `is_not_feasible`; the SQL filter in `getSummary` uses `tone = 'not_feasible'`.
- If the database is already migrated, add a Drizzle migration for the rename and read the generated SQL before applying it (renaming an enum value may need a hand-reviewed statement). If nothing is migrated yet, define the new names from the start.
- Keep the pill colour (dark grey) unless the user says otherwise (**CONFIRM**).

**Acceptance:**
- [ ] A text search of the rendered dashboard (all pages, modal open, both themes) finds no status text matching `/cancel/i`; action buttons named "Cancel" are excluded from this check
- [ ] The 14 plazas that were Cancelled now show Not Feasible in Civil Work, System Integrator, Toll Notification and Name of Toll Operator
- [ ] Counts are unchanged by the rename (14 per field)
- [ ] The repository contains no `cancelled` in status code identifiers, fixtures or tests (action-button strings excepted)

---

## 7. Change 6: Layout filter options

**Request:** "In Layout filter, Dropdown option 1. Done, 2. Not Feasible, 3. In-process."

**Today:** The workbook has only `Done` (7 plazas) for Layout; the other 85 are blank. "Not Feasible" and "In-process" do not exist for Layout yet.

**Required:** the Status of Layout dropdown lists, in this order:

| Order | Option | Pill tone |
|---|---|---|
| (reset) | All | not a status |
| 1 | Done | done (green) |
| 2 | Not Feasible | not feasible (dark grey) |
| 3 | In-process | in progress (amber) |

- Spelling exactly as written: **In-process** (hyphen, lowercase p).
- Add the two new values to `status_options` for the `layout` field with sort order 1, 2, 3 (Done already exists in the data).
- The same vocabulary feeds the Layout card, the input form dropdown, the pop-out and exports, so the filter and form can never disagree. The dropdown is filled from `GET /filters`, not hard-coded.
- **Existing data is not changed.** The 7 plazas with Done stay Done. The other 85 stay blank (shown as **Not updated** on the card and in the table). Do not copy Not Feasible from other fields into Layout (**CONFIRM** if that is wanted).

**Acceptance:**
- [ ] The Layout dropdown shows All, Done, Not Feasible, In-process, in that order, and nothing else (default)
- [ ] Choosing Done on the seed data returns 7 plazas; Not Feasible and In-process return 0
- [ ] The Layout card lists Done, Not Feasible, In-process and Not updated (85)
- [ ] The input form's Layout dropdown shows the same three options

**CONFIRM:**
- (a) With only three options, plazas with blank Layout cannot be selected from the dropdown. Add **Not updated** as a fourth entry (suggested), or leave it out? Default until answered: leave it out, and make the "Not updated" row on the Layout card display-only (not clickable).
- (b) Toll Notification currently uses "In Process" (workbook has both "In Process" and "In process"). Use the same spelling **In-process** there too? Default until answered: leave Toll Notification as "In Process".

---

## 8. Change 7: Full status field names everywhere

**Request:** "Replace the short form name of Statuses to the full Name of the Statuses." The user confirmed this means the **status field names**.

**Required:** use these names wherever a status field is named, with no short forms ("Civil Work", "Layout", "System Integrator", "Toll Notif.", "Toll Operator" alone are no longer allowed as labels):

| Key (internal, unchanged) | Full name to display |
|---|---|
| `civil` | Status of Civil Work |
| `layout` | Status of Layout |
| `system_integrator` (query key `si`) | Status of System Integrator |
| `toll_notification` (query key `notification`) | Status of Toll Notification |
| `toll_operator` (query key `operator`) | Name of Toll Operator |

Places: table column headers, mobile card labels, the five status card titles, the seven filter labels (Zone, Division, then the five above), filter chips, modal Status rows, input form labels, chart titles and axes, CSV/Excel column headers, details PDF.

**How:** create one shared constants file used by client and server and import it everywhere:

```ts
// shared/labels.ts
export const STATUS_FIELD_LABELS = {
  civil: 'Status of Civil Work',
  layout: 'Status of Layout',
  system_integrator: 'Status of System Integrator',
  toll_notification: 'Status of Toll Notification',
  toll_operator: 'Name of Toll Operator',
} as const;

export const NOT_FEASIBLE = 'Not Feasible';
export const NOT_UPDATED = 'Not updated';
```

Layout notes:
- Long headers wrap onto two lines in the table header; give status columns a minimum width so words do not break mid-word.
- The table must still not overflow horizontally at 1280 px (rule from earlier feedback). If the longer headers force overflow, tell the user; do not shrink the font below 13 px.
- Internal keys, URL query names and database enum values stay as they are; only the displayed text changes.

**Acceptance:**
- [ ] A Playwright check of the table headers returns exactly: Toll Plaza Code, Name of Road, Chainage, SH Name, APC, Type of Plaza, Status of Civil Work, Status of Layout, Status of System Integrator, Status of Toll Notification, Name of Toll Operator
- [ ] The five card titles and the seven filter labels use the full names
- [ ] The modal Status section uses the full names (Change 3)
- [ ] No component defines its own status label string (all import from `shared/labels.ts`)

---

## 9. Impact on the other documents

Update these places so the three files agree (do this in the same commit as the code):

| File | Section | Update |
|---|---|---|
| `CLAUDE.md` | 2 and 2.1 | Card titles use full names; replace `Cancelled` with `Not Feasible`; Layout vocabulary becomes Done, Not Feasible, In-process |
| `CLAUDE.md` | 3 (item 7) and 1.1 | Note the mapping `Cancelled` to `Not Feasible` on import; chainage text rule |
| `CLAUDE.md` | 4.1 | Seven filters use full names; KPI "Cancelled" becomes "Not Feasible"; table first column becomes Toll Plaza Code; header is sticky |
| `CLAUDE.md` | 4.3 and 7 | "Drawer" becomes centred modal; component `PlazaDrawer` becomes `PlazaDetailModal`; Status section layout |
| `CLAUDE.md` | 5.2 and 5.5 | `statusToneEnum` value `not_feasible`; `getSummary` key `notFeasible` |
| `CLAUDE.md` | 8 | Add the CONFIRM points from this file |
| `SECURITY_UX_TESTING.md` | 3.2 (items 8 to 11) | "Details drawer" becomes centred modal |
| `SECURITY_UX_TESTING.md` | 4.3 (data and UI tests) | Replace "14 cancelled" with "14 Not Feasible"; add the tests in section 10 |

---

## 10. Tests for this change request

| Level | Test |
|---|---|
| Unit | Label constants: every status field has one full name; no label equals a banned short form |
| Unit | Import mapping: raw `Cancelled` becomes `Not Feasible` in all four fields; `import_log` has 4 x 14 entries |
| Integration (API) | `GET /filters` returns Layout options in order Done, Not Feasible, In-process; `GET /summary` returns `kpis.notFeasible` = 14 on the seed and no `cancelled` key |
| Integration (API) | Filtering Layout by Not Feasible or In-process on the seed returns 0; by Done returns 7; card totals still equal `kpis.plazas` and `/plazas` total (the core invariant from `CLAUDE.md` 4.1.1) |
| Component | Status section renders five labelled rows in the fixed order; blank value renders "Not updated" |
| E2E (Playwright) | Click a row: modal is centred; Esc, × and backdrop close it; focus returns to the row |
| E2E (Playwright) | Scroll 1,000 px: table header top equals page header bottom, at 1280 and 1100 px, light and dark |
| E2E (Playwright) | Page-text scan finds no status text matching `/cancel/i` (action buttons excluded) |
| E2E (Playwright) | Table header texts equal the list in section 8 |
| Visual regression | Table with sticky header, modal, and status cards in both themes at 360, 768, 1280 px |
| Accessibility | axe scan with the modal open: no critical violations; focus trap verified |
| Regression | Full existing suite passes after the rename (counts, filters, upload, download) |

---

## 11. Definition of done

- [ ] All seven changes meet their acceptance lists
- [ ] Tests in section 10 written and passing in CI
- [ ] `CLAUDE.md` and `SECURITY_UX_TESTING.md` updated as in section 9
- [ ] No horizontal overflow at 360, 768 and 1280 px in either theme
- [ ] User has seen the result on a real screen and answered the CONFIRM points below

---

## 12. Open questions (CONFIRM before or while building)

1. Keep or remove the `plaza_name` field in the database and form after the column becomes Toll Plaza Code? (default: keep, hidden from the table)
2. Toll Plaza Code format and whether it must be unique.
3. Phone width: should the modal fill the whole screen? (default: yes)
4. Should the 14 chainage values reading `Cancelled` display as Not Feasible? (default: yes)
5. Keep the dark grey pill colour for Not Feasible? (default: yes)
6. Add **Not updated** to the Layout dropdown so blank-Layout plazas can be filtered? (default: no)
7. Should any plaza's Layout be set to Not Feasible or In-process now, for example the 14 Not Feasible plazas? (default: no, existing data unchanged)
8. Use "In-process" spelling for Toll Notification too? (default: no)