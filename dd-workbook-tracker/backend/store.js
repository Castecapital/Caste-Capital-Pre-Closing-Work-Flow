// SQLite-backed storage. Every function here keeps the exact same async
// signature the old fs-based version had, so server.js, dealTemplate.js,
// reports.js, and import-workbook.js needed zero changes for this
// migration - only this file's internals changed.

import { db } from "./db.js";

// Which extra (tab-specific) columns belong on an item, by source_tab. The
// base fields below are common to every item; readItems only includes a
// tab's extra fields on its own rows, omitting the rest entirely (not
// setting them null) - the frontend relies on `"field" in item` checks
// (e.g. ItemDetail.jsx's `"is_critical_path" in item`) to tell tabs apart,
// exactly like the original per-tab object construction in
// import-workbook.js did.
const BASE_ITEM_FIELDS = [
  "item_id",
  "source_tab",
  "status",
  "responsible_party",
  "external_party",
  "comments",
  "linked_items",
  "opened_date",
  "last_updated",
  "history",
];

const EXTRA_FIELDS_BY_TAB = {
  "DD Full Checklist": ["category", "phase", "action_item", "outside_date_raw", "outside_date", "is_internal", "is_critical_path"],
  "Internal DD Request List": ["div_folder", "document", "department"],
  "External DD List": ["div_folder", "document", "department"],
  "HAP Assignment Checklist": ["section_number", "sub_item_letter", "item_description", "proposed_owner_info"],
  "Lender Checklist": ["entity_group", "document"],
};

const BOOLEAN_FIELDS = new Set(["is_internal", "is_critical_path"]);
const JSON_FIELDS = new Set(["comments", "linked_items", "history"]);

const ALL_ITEM_COLUMNS = [
  ...BASE_ITEM_FIELDS,
  "category",
  "phase",
  "action_item",
  "outside_date_raw",
  "outside_date",
  "is_internal",
  "is_critical_path",
  "div_folder",
  "document",
  "department",
  "section_number",
  "sub_item_letter",
  "item_description",
  "proposed_owner_info",
  "entity_group",
];

function rowToItem(row) {
  const fields = [...BASE_ITEM_FIELDS, ...(EXTRA_FIELDS_BY_TAB[row.source_tab] ?? [])];
  const item = {};
  for (const field of fields) {
    let value = row[field];
    if (JSON_FIELDS.has(field)) value = value === null ? (field === "linked_items" ? null : []) : JSON.parse(value);
    else if (BOOLEAN_FIELDS.has(field)) value = !!value;
    item[field] = value;
  }
  return item;
}

function itemToRow(dealId, item) {
  const row = { deal_id: dealId };
  for (const col of ALL_ITEM_COLUMNS) {
    let value = item[col] ?? null;
    if (JSON_FIELDS.has(col)) value = value === null ? (col === "linked_items" ? null : "[]") : JSON.stringify(value);
    else if (BOOLEAN_FIELDS.has(col)) value = value ? 1 : 0;
    row[col] = value;
  }
  return row;
}

export async function readDealsRegistry() {
  return db.prepare("SELECT id, name, created_at FROM deals ORDER BY rowid ASC").all();
}

export async function writeDealsRegistry(deals) {
  // The one caller (dealTemplate.js) always passes the full desired list
  // (existing entries + one new one) and never removes a deal, so this
  // upserts every entry rather than delete-and-reinsert - deleting a deals
  // row would CASCADE-delete that deal's items via the foreign key.
  const upsert = db.prepare(`
    INSERT INTO deals (id, name, created_at) VALUES (@id, @name, @created_at)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, created_at = excluded.created_at
  `);
  const txn = db.transaction((rows) => rows.forEach((r) => upsert.run(r)));
  txn(deals);
}

export async function dealExists(dealId) {
  return !!db.prepare("SELECT 1 FROM deals WHERE id = ?").get(dealId);
}

export async function readItems(dealId) {
  const rows = db.prepare("SELECT * FROM items WHERE deal_id = ? ORDER BY rowid ASC").all(dealId);
  return rows.map(rowToItem);
}

export async function writeItems(dealId, items) {
  const columns = ["deal_id", ...ALL_ITEM_COLUMNS];
  const placeholders = columns.map((c) => `@${c}`).join(", ");
  const insert = db.prepare(`INSERT INTO items (${columns.join(", ")}) VALUES (${placeholders})`);
  const txn = db.transaction((rows) => {
    db.prepare("DELETE FROM items WHERE deal_id = ?").run(dealId);
    for (const item of rows) insert.run(itemToRow(dealId, item));
  });
  txn(items);
}

export async function readDealConfig(dealId) {
  const row = db.prepare("SELECT * FROM deal_config WHERE deal_id = ?").get(dealId);
  if (!row) return null;
  const { deal_id, ...config } = row;
  return config;
}

export async function writeDealConfig(dealId, config) {
  db.prepare(`
    INSERT INTO deal_config (deal_id, deal_name, loi_date, psa_execution_date, initial_deposit_date, rollover_ts_date, dd_exit_deposit_date, projected_hud_approval_date, projected_closing_date, outside_closing_date)
    VALUES (@deal_id, @deal_name, @loi_date, @psa_execution_date, @initial_deposit_date, @rollover_ts_date, @dd_exit_deposit_date, @projected_hud_approval_date, @projected_closing_date, @outside_closing_date)
    ON CONFLICT(deal_id) DO UPDATE SET
      deal_name = excluded.deal_name, loi_date = excluded.loi_date, psa_execution_date = excluded.psa_execution_date,
      initial_deposit_date = excluded.initial_deposit_date, rollover_ts_date = excluded.rollover_ts_date,
      dd_exit_deposit_date = excluded.dd_exit_deposit_date, projected_hud_approval_date = excluded.projected_hud_approval_date,
      projected_closing_date = excluded.projected_closing_date, outside_closing_date = excluded.outside_closing_date
  `).run({ deal_id: dealId, ...config });
}

export async function readDealTeam(dealId) {
  return db
    .prepare("SELECT role, organization, name FROM deal_team WHERE deal_id = ? ORDER BY id ASC")
    .all(dealId);
}

export async function writeDealTeam(dealId, team) {
  const insert = db.prepare("INSERT INTO deal_team (deal_id, role, organization, name) VALUES (?, ?, ?, ?)");
  const txn = db.transaction((members) => {
    db.prepare("DELETE FROM deal_team WHERE deal_id = ?").run(dealId);
    for (const m of members) insert.run(dealId, m.role ?? "", m.organization ?? "", m.name ?? "");
  });
  txn(team);
}

export async function readHapConfig(dealId) {
  const row = db.prepare("SELECT * FROM hap_config WHERE deal_id = ?").get(dealId);
  if (!row) return null;
  const { deal_id, ...config } = row;
  return config;
}

export async function writeHapConfig(dealId, config) {
  db.prepare(`
    INSERT INTO hap_config (deal_id, name, address, contract, new_owner, seller, fha_number, pbca, hud_ae)
    VALUES (@deal_id, @name, @address, @contract, @new_owner, @seller, @fha_number, @pbca, @hud_ae)
    ON CONFLICT(deal_id) DO UPDATE SET
      name = excluded.name, address = excluded.address, contract = excluded.contract, new_owner = excluded.new_owner,
      seller = excluded.seller, fha_number = excluded.fha_number, pbca = excluded.pbca, hud_ae = excluded.hud_ae
  `).run({ deal_id: dealId, ...config });
}

export async function readLenderConfig(dealId) {
  const row = db.prepare("SELECT * FROM lender_config WHERE deal_id = ?").get(dealId);
  if (!row) return null;
  const { deal_id, ...config } = row;
  return config;
}

export async function writeLenderConfig(dealId, config) {
  db.prepare(`
    INSERT INTO lender_config (deal_id, lender_name) VALUES (@deal_id, @lender_name)
    ON CONFLICT(deal_id) DO UPDATE SET lender_name = excluded.lender_name
  `).run({ deal_id: dealId, ...config });
}

function rowToCostTask(row) {
  return {
    task_id: row.task_id,
    phase: row.phase,
    task: row.task,
    party: row.party,
    start_date: row.start_date,
    end_date: row.end_date,
    duration_days: row.duration_days,
    budget: row.budget,
    proposal_cost: row.proposal_cost,
    spent: row.spent,
    remaining: row.remaining,
    monthly_spend: row.monthly_spend ? JSON.parse(row.monthly_spend) : [],
    linked_items: row.linked_items ? JSON.parse(row.linked_items) : null,
  };
}

export async function readCostSchedule(dealId) {
  const rows = db.prepare("SELECT * FROM cost_schedule WHERE deal_id = ? ORDER BY rowid ASC").all(dealId);
  return rows.map(rowToCostTask);
}

export async function writeCostSchedule(dealId, tasks) {
  const insert = db.prepare(`
    INSERT INTO cost_schedule (deal_id, task_id, phase, task, party, start_date, end_date, duration_days, budget, proposal_cost, spent, remaining, monthly_spend, linked_items)
    VALUES (@deal_id, @task_id, @phase, @task, @party, @start_date, @end_date, @duration_days, @budget, @proposal_cost, @spent, @remaining, @monthly_spend, @linked_items)
  `);
  const txn = db.transaction((rows) => {
    db.prepare("DELETE FROM cost_schedule WHERE deal_id = ?").run(dealId);
    for (const t of rows) {
      insert.run({
        deal_id: dealId,
        task_id: t.task_id,
        phase: t.phase ?? null,
        task: t.task ?? null,
        party: t.party ?? null,
        start_date: t.start_date ?? null,
        end_date: t.end_date ?? null,
        duration_days: t.duration_days ?? null,
        budget: t.budget ?? null,
        proposal_cost: t.proposal_cost ?? null,
        spent: t.spent ?? null,
        remaining: t.remaining ?? null,
        monthly_spend: JSON.stringify(t.monthly_spend ?? []),
        linked_items: t.linked_items ? JSON.stringify(t.linked_items) : null,
      });
    }
  });
  txn(tasks);
}

// Reports (Step 10) are saved permanently in the same database as
// everything else now, content included - not as loose files on disk -
// so a single persistent-volume mount covers the whole app's state, reports
// included, on platforms with an otherwise ephemeral filesystem.
export async function readReportsIndex(dealId) {
  return db
    .prepare("SELECT id, type, label, filename, generated_at FROM reports WHERE deal_id = ? ORDER BY generated_at DESC")
    .all(dealId);
}

export async function saveReport(dealId, { id, type, label, filename, content, generatedAt }) {
  db.prepare(`
    INSERT INTO reports (id, deal_id, type, label, filename, generated_at, content)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, dealId, type, label, filename, generatedAt, content);
  return { id, type, label, filename, generated_at: generatedAt };
}

export async function readReportContent(dealId, filename) {
  const row = db.prepare("SELECT content FROM reports WHERE deal_id = ? AND filename = ?").get(dealId, filename);
  if (!row) throw new Error(`report file '${filename}' not found for deal '${dealId}'`);
  return row.content;
}
