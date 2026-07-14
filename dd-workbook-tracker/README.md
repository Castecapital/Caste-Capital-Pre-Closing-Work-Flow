# DD Workbook Tracker

Internal tool for managing the Section 8 / HUD multifamily acquisition due
diligence workbook, from PSA execution through closing. Built as a reusable
template — no dates or deal-specific data are hardcoded into the app itself.

Stack: React + Vite + Tailwind (frontend), Node/Express (backend), JSON files
for storage (no database).

## Status

**Step 1 (shared workflow engine + Deal Team directory) and Step 2 (Master DD
Tracker) are built and working end-to-end.** Steps 3-10 (Internal/External DD
lists, HAP Assignment Checklist, Lender Checklist, Cost Schedule, dashboard,
dependency view, deal cloning, workflow automation, reporting) are not yet
built.

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

Only the **Deal Team** and **DD Full Checklist** tabs are imported so far.
The script prints anomalies it hit along the way (data-entry issues in the
source file, fields it couldn't confidently map) rather than silently
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
```

## API

- `GET /api/deals`
- `GET /api/deals/:dealId/items?source_tab=...`
- `POST /api/deals/:dealId/items`
- `PUT /api/deals/:dealId/items/:itemId` — auto-appends to `history[]` when `status` changes
- `POST /api/deals/:dealId/items/:itemId/comments` — appends a comment + history entry
- `GET /api/deals/:dealId/deal-config`, `PUT ...`
- `GET /api/deals/:dealId/deal-team?q=...`, `PUT ...`
