# DD Workbook Tracker

Internal tool for managing the Section 8 / HUD multifamily acquisition due
diligence workbook, from PSA execution through closing. Built as a reusable
template — no dates or deal-specific data are hardcoded into the app itself.

Stack: React + Vite + Tailwind (frontend), Node/Express (backend), SQLite via
better-sqlite3 for storage. Gated behind a single shared-password login (see
[Authentication](#authentication) below).

## Status

**All 10 steps of the original spec are built and working end-to-end**,
plus a follow-up infrastructure pass: storage migrated from JSON files to
SQLite (deploy-safe with a persistent volume) and a shared-password login
gate (see [Authentication](#authentication)):
shared workflow engine, Deal Team directory, Master DD Tracker,
Internal/External DD Request Lists (with cross-tab link suggestions), HAP
Assignment Checklist (grouped by section, with a HAP General Info panel),
Lender Checklist (grouped by entity group, including the separate
supplemental-requests list, with a Lender Info panel), Cost Schedule (its
own module — a budget/Gantt tracker, not a document checklist — with a
budget/spent/remaining rollup), a Dashboard home view, a dedicated Critical
Path page, a deal-switcher with "New Deal" cloning, and a Reports page
(Weekly Agenda + per-tab CSV export, all permanently saved per deal). The UI
has an Apple-style visual design (SF-like type, muted neutrals with a
single blue accent, translucent sticky two-row nav, rounded cards).

**Dashboard** (`/`, the new home page — Master DD Tracker moved to
`/master-dd-tracker`):
- Countdown tiles for LOI, PSA Execution, Projected HUD Approval, Projected
  Closing, and Outside Closing Date — each hidden entirely when its
  `deal_config` date is null, turning red under 30 days remaining (including
  already-overdue dates, shown as "N over").
- **Blocking Closing**: Master DD Tracker items that are Open/Blocked *and*
  critical-path, plus anything (any tab, including Cost Schedule tasks)
  linked to one of those items — so a Lender Checklist item linked to a
  blocked critical DD item surfaces here too, not just the DD item itself.
- **Stalled Items**: Open items (any tab) not updated in over 7 days,
  oldest first. This runs purely off `last_updated`, never due dates, so it
  works identically whether or not any deal dates are filled in.
- **Workbook Summary**: an open/closed proportion bar per tab; Cost Schedule
  shows a task count instead, since it has no status field to summarize.

**Critical Path** (`/critical-path`): every Master DD Tracker item flagged
`is_critical_path`, each showing what it's linked to specifically in the
Lender Checklist, HAP Assignment Checklist, or Cost Schedule (links to other
tabs, e.g. Internal DD List, are intentionally out of scope for this page —
see them on the item's own detail page instead). A "Blocked by open
dependencies" note appears per critical item when any of those relevant
links isn't Closed. Verified the tab-filtering by linking a critical item to
one entity in each of the 4 tabs at once and confirming only the 3 in-scope
ones rendered.

**Deal switcher & "New Deal" cloning**: the deal name in the top nav (next
to the app title) is a dropdown listing every deal, plus a "+ New Deal"
form. Creating a deal clones `deal-1`'s 5 checklist tabs (400 items) as a
reusable template — taxonomy fields (category, phase→reset to "PSA
Execution", department, section/topic, entity_group, is_critical_path,
is_internal, the item text itself) are kept, everything deal-specific is
reset: `status` → `"Open"`, `responsible_party` → `"Unassigned"`,
`external_party`/`linked_items` → `null`, `comments`/`history` → `[]`,
`opened_date`/`last_updated` → the new deal's creation date,
`outside_date`/`outside_date_raw` → `null`. `deal_config.json`,
`hap_config.json`, and `lender_config.json` start blank (only `deal_name`
set, to whatever the team typed). Cost Schedule and Deal Team are **not**
templated — both start empty, since a budget's dollar figures and a deal
team's people are inherently per-deal, not a reusable taxonomy the way
category/department/entity_group are. Switching deals is a full page
reload back to the Dashboard (the app has no cross-page shared state to
otherwise invalidate); the current deal persists in `localStorage`, not the
URL. Verified end-to-end via the actual UI (not just the API): created a
test deal, confirmed all 400 items came through as a blank "Open" template
with the real taxonomy intact, switched back to deal-1, and confirmed its
real data (statuses, comments, dates) was completely unaffected.

The general "given any item, show its linked_items across tabs and their
current status" dependency view from this same step is the **Linked Items**
section already on every item's detail page (built in Steps 3 and 6) - the
Critical Path page is the net-new piece: a dedicated cross-tab rollup
scoped to just the critical-path items.

Every item (any tab) has a detail page at `/items/:itemId` — click any table
row to get there. It shows all fields, comments (with add-comment), full
change history, and linked items. For Internal/External DD list items it
also surfaces **suggested links**: documents in the opposite list with a
similar name, scored by name overlap, with a one-click "Link" button. Every
item's detail page also has a manual **"Link to Cost Schedule"** search
widget, so e.g. a Master DD Tracker item can be pointed at its corresponding
budget task even though Cost Schedule tasks live in a separate collection
with no shared fields. Links are bidirectional either way, and nothing is
ever auto-linked. If a linked item isn't "Closed," a "Blocked by open
dependencies" banner appears (Cost Schedule tasks, having no status, never
trigger it) — this is technically Step 4/8 scope but fell out naturally
from the linked-items model built for Step 3's suggestions.

**Reports** (`/reports`) — and this is the important part: **every
generated report is saved on the server, not just handed to the browser as
a one-off download.** Each generation writes the file to
`data/deals/<id>/reports/` and appends an entry to `reports.json`; the
Reports page lists every report ever generated for the current deal with a
"Download" link that re-serves the saved file, so nothing is lost the
moment a browser download completes or a tab gets closed. Two report types:
- **Generate Weekly Agenda**: every Open/At Risk item across all 5
  checklist tabs (Cost Schedule is excluded — it has no status), grouped by
  tab then by that tab's own taxonomy (category/department/section/entity
  group), as Markdown with item #, title, responsible party, and latest
  comment.
- **Export to CSV**, per tab, matching each tab's real original spreadsheet
  columns — including reconstructing the split-out CC Comment / Partner
  Comment / DIV Comment / Notes columns from the normalized `comments[]`
  array, since the source file had those as separate columns before import
  folded them together. Available both centrally on the Reports page and as
  an "Export to CSV" button directly on each tab's own list view (Master DD
  Tracker, Internal/External DD List, HAP Checklist, Lender Checklist).
  Deleted-status rows are excluded, matching the same show/hide convention
  used everywhere else in the app.

Verified via the actual UI with real downloads (not just the API): 205
Open/At Risk items came through the agenda correctly grouped; a 144-row DD
Full Checklist CSV and other tab exports downloaded with the right headers;
every generated report appeared in the saved-reports list with a working
re-download link, confirmed by fetching that exact link directly and
checking the response headers and content. Also re-verified the change-log
history section (built in Step 1) renders correctly on Internal DD List,
Lender Checklist, and HAP items, not just the Master DD Tracker.

## Running locally

```bash
# backend
cd backend
npm install
cp .env.example .env   # then edit .env and set APP_PASSWORD - see Authentication below
npm start               # http://localhost:3001

# frontend (separate terminal)
cd frontend
npm install
npm run dev              # http://localhost:5173, proxies /api to the backend
```

The backend refuses to start without `APP_PASSWORD` set.

## Deploying

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a step-by-step Railway
walkthrough (single service - the backend serves both the API and the
built frontend from one origin), the persistent-volume requirement for
the SQLite database (Railway doesn't provide this automatically), and
production build/start commands.

## Authentication

The app is gated behind a single shared password for the whole team - not
per-user accounts. This is intentionally lightweight, fine for an internal
tool with a handful of users. If you later want per-person logins or an
audit trail of who changed what, that's a bigger step up (real auth + a
users table).

- **`APP_PASSWORD`** (backend env var, required, never hardcoded/committed):
  the one password everyone on the team uses to sign in. Set it in
  `backend/.env` locally (copy `backend/.env.example` as a starting point);
  when deploying, set it as a platform environment variable in your
  host's dashboard/CLI (Render, Railway, etc.) rather than committing it
  anywhere.
- `POST /api/login` accepts `{ password }`, compares it to `APP_PASSWORD`
  using a constant-time comparison, and on success sets an `HttpOnly`,
  `SameSite=Lax` signed session cookie (`Secure` too, once `NODE_ENV` is
  `production` and the app is served over HTTPS) good for 12 hours.
- Every other `/api/*` route requires that cookie; the frontend shows a
  login screen whenever it doesn't have a valid session, and a "Log Out"
  button (top-right of the nav) calls `POST /api/logout` to clear it
  server-side.
- Nothing password- or session-related is ever written to
  `localStorage`/`sessionStorage` - only the cookie holds session state.
- **Rotate `APP_PASSWORD`** (change the env var and redeploy) if it's ever
  shared outside the immediate team.

## Re-running the import

The one-time import script (`backend/scripts/import-workbook.js`) parses
`backend/scripts/source-data/RAP_UP_DD_Work_Log_Internal.xlsx` and seeds
deal-1 in the SQLite database (registering the deal itself first, then its
items/config/team/cost-schedule tables). It's safe to re-run on a fresh
database or an existing one — each table it touches is fully replaced, not
appended to.

```bash
cd backend
npm run import-workbook
# or: node scripts/import-workbook.js <path-to-xlsx> <deal-id>
```

All 7 tabs (**Deal Team**, **DD Full Checklist**, **Internal - DD Request
List**, **External - DD List**, **HAP Assignment Checklist**, **Lender
Checklist**, and **Cost Schedule**) are imported. The script prints
anomalies it hit along the way (data-entry issues in the source file, fields
it couldn't confidently map) rather than silently guessing at them.

### Import assumptions worth knowing about

- **`phase`** has no source column at all (the workbook only tracks
  category, not phase). All 144 imported items default to phase
  `"Active Due Diligence"` — reassign per item in the list view as the deal
  progresses through HUD Approval, JV Formation, Closing, etc.
- **`is_critical_path`** is not a source column either. It's set by exact
  item-number match against the list you gave (W&D UW DD Checklist, JV OA,
  GP OA, 2530 Clearance ×2, EOHLC waiver, Loan Docs, HAP Application, Lot L
  Tax Issue, HUD CAPEX Withdrawal/Suspension ×2 — items dd-11, dd-17, dd-18,
  dd-24, dd-25, dd-28, dd-31, dd-34, dd-65, dd-138, dd-139).
- **`opened_date` / `last_updated`** default to the import run date for
  every item, since the source has no per-item timestamps. This is a
  deliberate choice: backfilling fake historical dates would create false
  "stalled" signal once Step 7's aging logic ships.
- **`psa_execution_date`** in Deal Setup was left blank — the source's Key
  Dates block has no labeled "PSA execution" row (only "Initial Deposit
  ($50K)", which coincides with but isn't the same fact as PSA execution).
  Fill it in via the Deal Setup panel.
- Item **dd-89**'s Responsible Party cell literally contains `"Closed"` in
  the source file (a data-entry error, status value in the wrong column) —
  imported as-is rather than guessed at.
- Responsible Party initials (`PK`, `BA`, `AS`, `DS`) are resolved to full
  names against the Deal Team roster; combos (`AS/BA`) and org-level tags
  (`CC`) are left as raw text.
- **`status: "Received"`** appears on 28 of the 78 Internal DD Request List
  items (not a schema status). Per your call, these are mapped to `"Closed"`
  with the original `"Received"` value preserved as a comment on each item.
- The literal **"Deleted" placeholder rows** in both DD Request List tabs
  (item #6 in each) import with `status: "Deleted"`, `document: "[Deleted]"`,
  `department: null` — the row/number is preserved, not the fake text.
- **`department`** on both DD Request List tabs is carried down from
  section-header rows where the source left the per-row Department column
  blank (5 items on Internal, 3 on External).
- **HAP General Info** (name/address/contract/new owner/seller/FHA/PBCA/HUD
  AE) imports entirely blank — the source workbook's header block for these
  fields is an unfilled template, not missing data. Fill in via HAP Info.
- **`proposed_owner_info`** on every HAP item is the section's topic label
  carried down from its header row ("Proposed Owner Information",
  "Management Company Information", "Project Finances and Affordability",
  "Property Information") - the field name is literal only for Section 1;
  for the other three sections it's "what this section is about," not
  actually about the proposed owner.
- All 51 HAP items import with **`status: "Open"`** - the source Status
  column is entirely blank (never filled in for this checklist).
- One source quirk: HAP item **hap-4l**'s letter cell reads `"l ."` (stray
  space before the period). The `item_id` strips it correctly; the raw
  `sub_item_letter` field keeps the source text as-is.
- **`entity_group`** on the Lender Checklist has 8 values, not the 4 in the
  original spec — per your call, expanded to match the sheet exactly:
  Borrowing Entity, Key Principal / Guarantor, Principal Individuals,
  Principal Entities, Operating Statements, Insurance/Legal/Third-Party,
  Other, and Supplemental Requests (the separate document list tucked into
  column M of the same sheet, imported as its own 7 items rather than
  merged into the primary 44-item checklist).
- **`lender_name`** ("Northmarq") is parsed from the sheet's title cell
  (`"Northmarq - Lender Checklist"`), not a labeled field in the source.
- All 44 primary Lender Checklist items have Responsible Party = Alex
  Schultz in the source (resolved to his full name); the 7 supplemental
  items have no responsible party and import as `"Unassigned"`.
- **Cost Schedule's "Remaining" column** is a shared Excel formula
  (`Proposal Cost - Spent`); 3 of the 21 rows (source rows 5, 11, 16 - the
  first row of each shared-formula group) have no cached formula result at
  all in the file, so those are computed directly rather than imported as 0.
- **Monthly spend cells** with no cached formula result (common - most of
  these are date-range-conditional formulas Excel only caches a result for
  in one cell per shared group) import as `0` rather than being dropped from
  `monthly_spend`, since every task here only actually spans 1-2 months and
  the one cached sibling cell per row confirms 0 is the correct value for
  the rest, not just a fallback guess.
- Row 23 ("**Contingency**") has dollar figures but no task/party in the
  source — imports with `task: null`, `party: null` rather than inventing
  text; the list view shows "—" for both.
- `budget`/`proposal_cost`/`spent`/`remaining` totals across all 21 tasks
  ($545,000 / $463,075 / $0 / $463,075) match the source sheet's own
  precomputed "Total (Incl. Deposits)" row exactly, which cross-checks the
  import — those two source rows themselves are not imported as tasks.

## Data layout

Everything lives in one SQLite file (`backend/data/app.db` by default,
configurable via `DATABASE_PATH`), deal-scoped via a `deal_id` foreign key
(`ON DELETE CASCADE`) on every child table rather than separate files per
deal - this is what Step 9's "New Deal" cloning and any future multi-deal
feature key off of:

```
deals            # registry: id, name, created_at
items            # all workflow items, tagged by source_tab, deal_id FK
deal_config      # deal_name + key dates, all nullable, deal_id is the PK
deal_team        # role/organization/name roster, deal_id FK
hap_config       # HAP General Info, all nullable, deal_id is the PK
lender_config    # Lender Info (lender_name), nullable, deal_id is the PK
cost_schedule    # Cost Schedule tasks - separate module, not a workflow
                 # item (no status/comments/tab), deal_id FK
reports          # every generated report, content included, deal_id FK
```

**Deploying somewhere with an ephemeral filesystem** (Render, Railway, etc.):
the SQLite file itself must sit on a persistent/mounted volume, or all deal
data is lost on every redeploy/restart - see `DEPLOYMENT.md`.

Schema lives in `backend/db.js`; all reads/writes go through `backend/store.js`.
`backend/scripts/migrate-json-to-sqlite.js` is a one-time, re-runnable script
for migrating an older JSON-file-based copy of this app's data into SQLite -
not needed for a fresh setup, only relevant if you have pre-existing JSON
data to carry over.

## API

- `POST /api/login` — `{ password }`, sets the session cookie on success (no auth required to call this one)
- `POST /api/logout` — clears the session cookie
- `GET /api/session` — `{ ok: true }` if the session cookie is valid, `401` otherwise; everything below requires a valid session
- `GET /api/deals`
- `POST /api/deals` — `{ name }`, clones deal-1's checklist tabs as a blank template (see dealTemplate.js)
- `GET /api/deals/:dealId/items?source_tab=...`
- `GET /api/deals/:dealId/items/:itemId`
- `POST /api/deals/:dealId/items`
- `PUT /api/deals/:dealId/items/:itemId` — auto-appends to `history[]` when `status` changes
- `POST /api/deals/:dealId/items/:itemId/comments` — appends a comment + history entry
- `POST /api/deals/:dealId/items/:itemId/link` — `{ target_item_id }`, bidirectional, only fires on explicit user confirmation, resolves the target against items.json or cost_schedule.json
- `GET /api/deals/:dealId/deal-config`, `PUT ...`
- `GET /api/deals/:dealId/deal-team?q=...`, `PUT ...`
- `GET /api/deals/:dealId/hap-config`, `PUT ...`
- `GET /api/deals/:dealId/lender-config`, `PUT ...`
- `GET /api/deals/:dealId/cost-schedule`
- `GET /api/deals/:dealId/cost-schedule/:taskId`, `PUT ...`
- `GET /api/deals/:dealId/reports` — the saved-reports index
- `POST /api/deals/:dealId/reports/weekly-agenda` — generates, saves, and returns the Markdown content
- `POST /api/deals/:dealId/reports/csv/:sourceTab` — generates, saves, and returns the CSV content
- `GET /api/deals/:dealId/reports/:reportId/download` — re-serves a previously saved report with `Content-Disposition: attachment`
