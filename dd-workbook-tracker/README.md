# DD Workbook Tracker

Internal tool for managing the Section 8 / HUD multifamily acquisition due
diligence workbook, from PSA execution through closing. Built as a reusable
template — no dates or deal-specific data are hardcoded into the app itself.

Stack: React + Vite + Tailwind (frontend), Node/Express (backend), JSON files
for storage (no database).

## Status

**Steps 1-4 are built and working end-to-end**: shared workflow engine, Deal
Team directory, Master DD Tracker, Internal/External DD Request Lists (with
cross-tab link suggestions), and the HAP Assignment Checklist (grouped by
section, with a HAP General Info panel). The UI has an Apple-style visual
design (SF-like type, muted neutrals with a single blue accent, translucent
sticky two-row nav, rounded cards). Steps 5-10 (dedicated dependency/
critical-path view, Lender Checklist, Cost Schedule, dashboard, deal
cloning, workflow automation, reporting) are not yet built.

Every item (any tab) has a detail page at `/items/:itemId` — click any table
row to get there. It shows all fields, comments (with add-comment), full
change history, and linked items. For Internal/External DD list items it
also surfaces **suggested links**: documents in the opposite list with a
similar name, scored by name overlap, with a one-click "Link" button. Links
are bidirectional and nothing is ever auto-linked. If a linked item isn't
"Closed," a "Blocked by open dependencies" banner appears — this is
technically Step 4 scope but fell out naturally from the linked-items model
built for Step 3's suggestions.

## Running locally

```bash
# backend
cd backend
npm install
npm start          # http://localhost:3001

# frontend (separate terminal)
cd frontend
npm install
npm run dev         # http://localhost:5173, proxies /api to the backend
```

## Re-running the import

The one-time import script (`backend/scripts/import-workbook.js`) parses
`backend/scripts/source-data/RAP_UP_DD_Work_Log_Internal.xlsx` and seeds
`backend/data/deals/deal-1/`. It's safe to re-run — it overwrites that deal's
`items.json`, `deal_config.json`, and `deal_team.json` from scratch.

```bash
cd backend
npm run import-workbook
# or: node scripts/import-workbook.js <path-to-xlsx> <deal-id>
```

The **Deal Team**, **DD Full Checklist**, **Internal - DD Request List**,
**External - DD List**, and **HAP Assignment Checklist** tabs are imported so
far. The script prints anomalies it hit along the way (data-entry issues in
the source file, fields it couldn't confidently map) rather than silently
guessing at them.

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

## Data layout

Deal-scoped from the start (Step 9's multi-deal cloning needs this), even
though only one deal exists today and there's no deal-switcher UI yet:

```
backend/data/
  deals.json                  # registry: [{id, name, created_at}]
  deals/
    deal-1/
      items.json               # all workflow items, tagged by source_tab
      deal_config.json         # deal_name + key dates, all nullable
      deal_team.json           # role/organization/name roster
      hap_config.json          # HAP General Info, all nullable
```

## API

- `GET /api/deals`
- `GET /api/deals/:dealId/items?source_tab=...`
- `GET /api/deals/:dealId/items/:itemId`
- `POST /api/deals/:dealId/items`
- `PUT /api/deals/:dealId/items/:itemId` — auto-appends to `history[]` when `status` changes
- `POST /api/deals/:dealId/items/:itemId/comments` — appends a comment + history entry
- `POST /api/deals/:dealId/items/:itemId/link` — `{ target_item_id }`, bidirectional, only fires on explicit user confirmation
- `GET /api/deals/:dealId/deal-config`, `PUT ...`
- `GET /api/deals/:dealId/deal-team?q=...`, `PUT ...`
- `GET /api/deals/:dealId/hap-config`, `PUT ...`
