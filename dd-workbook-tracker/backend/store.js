// PostgreSQL-backed storage. Every function here keeps the exact same async
// signature the SQLite (and, before that, fs-based) version had, so
// server.js, dealTemplate.js, reports.js, and import-workbook.js needed
// zero changes for this migration - only this file's internals changed.

import { pool } from "./db.js";

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
// Stored as JSONB. Written pre-stringified (see itemToRow) because pg's
// parameter serialization treats a raw JS array as a Postgres array literal,
// not JSON - but read back already parsed, since pg parses jsonb columns
// into native JS values automatically.
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

// $1, $2, ... $n for however many columns are being bound - built once per
// query shape rather than per call.
function placeholders(n, offset = 0) {
  return Array.from({ length: n }, (_, i) => `$${i + 1 + offset}`).join(", ");
}

// SQLite's TEXT columns were happy to store "" for a cleared date field;
// Postgres's DATE columns reject it outright ("invalid input syntax for
// type date"). Nothing upstream reliably normalizes "" to null before it
// reaches here (registerConfigRoutes in server.js does, but item PUTs spread
// req.body straight through), so every raw value binds through this first.
function nullIfEmpty(value) {
  return value === "" ? null : value;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function rowToItem(row) {
  const fields = [...BASE_ITEM_FIELDS, ...(EXTRA_FIELDS_BY_TAB[row.source_tab] ?? [])];
  const item = {};
  for (const field of fields) {
    let value = row[field];
    if (JSON_FIELDS.has(field)) value = value === null ? (field === "linked_items" ? null : []) : value;
    else if (BOOLEAN_FIELDS.has(field)) value = !!value;
    item[field] = value;
  }
  return item;
}

function itemToRow(dealId, item) {
  const row = { deal_id: dealId };
  for (const col of ALL_ITEM_COLUMNS) {
    let value = nullIfEmpty(item[col] ?? null);
    if (JSON_FIELDS.has(col)) value = value === null ? (col === "linked_items" ? null : "[]") : JSON.stringify(value);
    else if (BOOLEAN_FIELDS.has(col)) value = value === null ? null : !!value;
    row[col] = value;
  }
  return row;
}

export async function readDealsRegistry() {
  const { rows } = await pool.query("SELECT id, name, created_at FROM deals ORDER BY seq ASC");
  return rows;
}

export async function writeDealsRegistry(deals) {
  // The one caller (dealTemplate.js) always passes the full desired list
  // (existing entries + one new one) and never removes a deal, so this
  // upserts every entry rather than delete-and-reinsert - deleting a deals
  // row would CASCADE-delete that deal's items via the foreign key. `seq`
  // is deliberately left out of the UPDATE SET so an existing deal's
  // registry position never shifts when it's re-upserted.
  await withTransaction(async (client) => {
    for (const d of deals) {
      await client.query(
        `INSERT INTO deals (id, name, created_at) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, created_at = EXCLUDED.created_at`,
        [d.id, d.name, nullIfEmpty(d.created_at ?? null)]
      );
    }
  });
}

export async function dealExists(dealId) {
  const { rows } = await pool.query("SELECT 1 FROM deals WHERE id = $1", [dealId]);
  return rows.length > 0;
}

export async function readItems(dealId) {
  const { rows } = await pool.query("SELECT * FROM items WHERE deal_id = $1 ORDER BY id ASC", [dealId]);
  return rows.map(rowToItem);
}

export async function writeItems(dealId, items) {
  const columns = ["deal_id", ...ALL_ITEM_COLUMNS];
  const sql = `INSERT INTO items (${columns.join(", ")}) VALUES (${placeholders(columns.length)})`;
  await withTransaction(async (client) => {
    await client.query("DELETE FROM items WHERE deal_id = $1", [dealId]);
    for (const item of items) {
      const row = itemToRow(dealId, item);
      await client.query(sql, columns.map((c) => row[c]));
    }
  });
}

export async function readDealConfig(dealId) {
  const { rows } = await pool.query("SELECT * FROM deal_config WHERE deal_id = $1", [dealId]);
  if (!rows.length) return null;
  const { deal_id, ...config } = rows[0];
  return config;
}

const DEAL_CONFIG_COLUMNS = [
  "deal_name",
  "loi_date",
  "psa_execution_date",
  "initial_deposit_date",
  "rollover_ts_date",
  "dd_exit_deposit_date",
  "projected_hud_approval_date",
  "projected_closing_date",
  "outside_closing_date",
];

export async function writeDealConfig(dealId, config) {
  const columns = ["deal_id", ...DEAL_CONFIG_COLUMNS];
  const updateSet = DEAL_CONFIG_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  await pool.query(
    `INSERT INTO deal_config (${columns.join(", ")}) VALUES (${placeholders(columns.length)})
     ON CONFLICT (deal_id) DO UPDATE SET ${updateSet}`,
    [dealId, ...DEAL_CONFIG_COLUMNS.map((c) => nullIfEmpty(config[c] ?? null))]
  );
}

export async function readDealTeam(dealId) {
  const { rows } = await pool.query(
    "SELECT role, organization, name FROM deal_team WHERE deal_id = $1 ORDER BY id ASC",
    [dealId]
  );
  return rows;
}

export async function writeDealTeam(dealId, team) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM deal_team WHERE deal_id = $1", [dealId]);
    for (const m of team) {
      await client.query("INSERT INTO deal_team (deal_id, role, organization, name) VALUES ($1, $2, $3, $4)", [
        dealId,
        m.role ?? "",
        m.organization ?? "",
        m.name ?? "",
      ]);
    }
  });
}

export async function readHapConfig(dealId) {
  const { rows } = await pool.query("SELECT * FROM hap_config WHERE deal_id = $1", [dealId]);
  if (!rows.length) return null;
  const { deal_id, ...config } = rows[0];
  return config;
}

const HAP_CONFIG_COLUMNS = ["name", "address", "contract", "new_owner", "seller", "fha_number", "pbca", "hud_ae"];

export async function writeHapConfig(dealId, config) {
  const columns = ["deal_id", ...HAP_CONFIG_COLUMNS];
  const updateSet = HAP_CONFIG_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  await pool.query(
    `INSERT INTO hap_config (${columns.join(", ")}) VALUES (${placeholders(columns.length)})
     ON CONFLICT (deal_id) DO UPDATE SET ${updateSet}`,
    [dealId, ...HAP_CONFIG_COLUMNS.map((c) => config[c] ?? null)]
  );
}

export async function readLenderConfig(dealId) {
  const { rows } = await pool.query("SELECT * FROM lender_config WHERE deal_id = $1", [dealId]);
  if (!rows.length) return null;
  const { deal_id, ...config } = rows[0];
  return config;
}

export async function writeLenderConfig(dealId, config) {
  await pool.query(
    `INSERT INTO lender_config (deal_id, lender_name) VALUES ($1, $2)
     ON CONFLICT (deal_id) DO UPDATE SET lender_name = EXCLUDED.lender_name`,
    [dealId, config.lender_name ?? null]
  );
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
    monthly_spend: row.monthly_spend ?? [],
    linked_items: row.linked_items ?? null,
  };
}

export async function readCostSchedule(dealId) {
  const { rows } = await pool.query("SELECT * FROM cost_schedule WHERE deal_id = $1 ORDER BY id ASC", [dealId]);
  return rows.map(rowToCostTask);
}

const COST_TASK_COLUMNS = [
  "task_id",
  "phase",
  "task",
  "party",
  "start_date",
  "end_date",
  "duration_days",
  "budget",
  "proposal_cost",
  "spent",
  "remaining",
  "monthly_spend",
  "linked_items",
];

export async function writeCostSchedule(dealId, tasks) {
  const columns = ["deal_id", ...COST_TASK_COLUMNS];
  const sql = `INSERT INTO cost_schedule (${columns.join(", ")}) VALUES (${placeholders(columns.length)})`;
  await withTransaction(async (client) => {
    await client.query("DELETE FROM cost_schedule WHERE deal_id = $1", [dealId]);
    for (const t of tasks) {
      const params = [
        dealId,
        t.task_id,
        t.phase ?? null,
        t.task ?? null,
        t.party ?? null,
        nullIfEmpty(t.start_date ?? null),
        nullIfEmpty(t.end_date ?? null),
        t.duration_days ?? null,
        t.budget ?? null,
        t.proposal_cost ?? null,
        t.spent ?? null,
        t.remaining ?? null,
        JSON.stringify(t.monthly_spend ?? []),
        t.linked_items ? JSON.stringify(t.linked_items) : null,
      ];
      await client.query(sql, params);
    }
  });
}

// Reports (Step 10) are saved permanently in the same database as
// everything else - not as loose files on disk - so the whole app's state,
// reports included, survives redeploys/restarts without needing a mounted
// disk (Postgres migration; previously this needed a persistent volume for
// the SQLite file - see DEPLOYMENT.md).
export async function readReportsIndex(dealId) {
  const { rows } = await pool.query(
    "SELECT id, type, label, filename, generated_at FROM reports WHERE deal_id = $1 ORDER BY generated_at DESC",
    [dealId]
  );
  return rows;
}

export async function saveReport(dealId, { id, type, label, filename, content, generatedAt }) {
  await pool.query(
    `INSERT INTO reports (id, deal_id, type, label, filename, generated_at, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, dealId, type, label, filename, generatedAt, content]
  );
  return { id, type, label, filename, generated_at: generatedAt };
}

export async function readReportContent(dealId, filename) {
  const { rows } = await pool.query("SELECT content FROM reports WHERE deal_id = $1 AND filename = $2", [dealId, filename]);
  if (!rows.length) throw new Error(`report file '${filename}' not found for deal '${dealId}'`);
  return rows[0].content;
}
