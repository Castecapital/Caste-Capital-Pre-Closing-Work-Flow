// One-time data migration: copies every row from the old SQLite database
// into the new Postgres database (DATABASE_URL), preserving IDs and
// relationships. Run this once locally against a COPY of the production
// SQLite file, spot-check the results, and only then consider Postgres the
// source of truth - this script never touches or deletes the SQLite file.
//
// Postgres is stricter about types than SQLite was (empty-string dates,
// 0/1 vs boolean, etc.) - a row failing here with a clear table/key in the
// error is expected on first run, not a sign the script is broken; fix the
// offending value in the source (or extend the coercion helpers below) and
// re-run against a fresh Postgres database.
//
// Usage: node scripts/migrate-sqlite-to-postgres.js [path-to-sqlite-file]
//
// better-sqlite3 isn't a listed dependency (Step 5 cleanup, once this
// script confirmed Postgres worked) since the running app no longer uses
// SQLite at all - if you need to run this again later, `npm install
// better-sqlite3` first.

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_PATH = process.argv[2] || path.join(__dirname, "..", "data", "app.db");

const sqlite = new Database(SQLITE_PATH, { readonly: true });

function nullIfEmpty(value) {
  return value === "" ? null : value;
}

// SQLite already stores valid JSON text for these columns (store.js always
// wrote them via JSON.stringify) - pass the text straight through as the
// parameter and let Postgres parse it into jsonb, same as store.js's write
// path does for live writes.
function jsonPassthrough(value) {
  return value === null || value === undefined ? null : value;
}

const summary = [];

async function copyTable(name, { selectSql, columns, toParams, conflictKey }) {
  const sourceRows = sqlite.prepare(selectSql).all();
  const client = await pool.connect();
  let copied = 0;
  try {
    await client.query("BEGIN");
    const sql = `INSERT INTO ${name} (${columns.join(", ")}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})`;
    for (const row of sourceRows) {
      const key = conflictKey(row);
      try {
        await client.query(sql, toParams(row));
        copied++;
      } catch (err) {
        throw new Error(`${name} row ${JSON.stringify(key)} failed: ${err.message}`);
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM ${name}`);
  summary.push({
    table: name,
    source: sourceRows.length,
    copied,
    destinationTotal: Number(countRows[0].count),
  });
}

async function main() {
  console.log(`Migrating ${SQLITE_PATH} -> ${process.env.DATABASE_URL ?? "(local fallback Postgres)"}\n`);

  await copyTable("deals", {
    selectSql: "SELECT * FROM deals ORDER BY rowid ASC",
    columns: ["id", "name", "created_at"],
    toParams: (r) => [r.id, r.name, nullIfEmpty(r.created_at)],
    conflictKey: (r) => r.id,
  });

  await copyTable("items", {
    selectSql: "SELECT * FROM items ORDER BY rowid ASC",
    columns: [
      "deal_id",
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
    ],
    toParams: (r) => [
      r.deal_id,
      r.item_id,
      r.source_tab,
      r.status,
      r.responsible_party,
      r.external_party,
      jsonPassthrough(r.comments),
      jsonPassthrough(r.linked_items),
      nullIfEmpty(r.opened_date),
      nullIfEmpty(r.last_updated),
      jsonPassthrough(r.history),
      r.category,
      r.phase,
      r.action_item,
      r.outside_date_raw,
      nullIfEmpty(r.outside_date),
      r.is_internal === null ? null : !!r.is_internal,
      r.is_critical_path === null ? null : !!r.is_critical_path,
      r.div_folder,
      r.document,
      r.department,
      r.section_number,
      r.sub_item_letter,
      r.item_description,
      r.proposed_owner_info,
      r.entity_group,
    ],
    conflictKey: (r) => `${r.deal_id}/${r.item_id}`,
  });

  await copyTable("deal_config", {
    selectSql: "SELECT * FROM deal_config",
    columns: [
      "deal_id",
      "deal_name",
      "loi_date",
      "psa_execution_date",
      "initial_deposit_date",
      "rollover_ts_date",
      "dd_exit_deposit_date",
      "projected_hud_approval_date",
      "projected_closing_date",
      "outside_closing_date",
    ],
    toParams: (r) => [
      r.deal_id,
      r.deal_name,
      nullIfEmpty(r.loi_date),
      nullIfEmpty(r.psa_execution_date),
      nullIfEmpty(r.initial_deposit_date),
      nullIfEmpty(r.rollover_ts_date),
      nullIfEmpty(r.dd_exit_deposit_date),
      nullIfEmpty(r.projected_hud_approval_date),
      nullIfEmpty(r.projected_closing_date),
      nullIfEmpty(r.outside_closing_date),
    ],
    conflictKey: (r) => r.deal_id,
  });

  await copyTable("hap_config", {
    selectSql: "SELECT * FROM hap_config",
    columns: ["deal_id", "name", "address", "contract", "new_owner", "seller", "fha_number", "pbca", "hud_ae"],
    toParams: (r) => [r.deal_id, r.name, r.address, r.contract, r.new_owner, r.seller, r.fha_number, r.pbca, r.hud_ae],
    conflictKey: (r) => r.deal_id,
  });

  await copyTable("lender_config", {
    selectSql: "SELECT * FROM lender_config",
    columns: ["deal_id", "lender_name"],
    toParams: (r) => [r.deal_id, r.lender_name],
    conflictKey: (r) => r.deal_id,
  });

  await copyTable("deal_team", {
    selectSql: "SELECT * FROM deal_team ORDER BY id ASC",
    columns: ["deal_id", "role", "organization", "name"],
    toParams: (r) => [r.deal_id, r.role, r.organization, r.name],
    conflictKey: (r) => `${r.deal_id}/${r.id}`,
  });

  await copyTable("cost_schedule", {
    selectSql: "SELECT * FROM cost_schedule ORDER BY rowid ASC",
    columns: [
      "deal_id",
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
    ],
    toParams: (r) => [
      r.deal_id,
      r.task_id,
      r.phase,
      r.task,
      r.party,
      nullIfEmpty(r.start_date),
      nullIfEmpty(r.end_date),
      r.duration_days,
      r.budget,
      r.proposal_cost,
      r.spent,
      r.remaining,
      jsonPassthrough(r.monthly_spend),
      jsonPassthrough(r.linked_items),
    ],
    conflictKey: (r) => `${r.deal_id}/${r.task_id}`,
  });

  await copyTable("reports", {
    selectSql: "SELECT * FROM reports ORDER BY rowid ASC",
    columns: ["id", "deal_id", "type", "label", "filename", "generated_at", "content"],
    toParams: (r) => [r.id, r.deal_id, r.type, r.label, r.filename, r.generated_at, r.content],
    conflictKey: (r) => r.id,
  });

  console.log("Table            Source  Copied  Postgres total  Match?");
  console.log("----------------------------------------------------------");
  let allMatch = true;
  for (const row of summary) {
    const match = row.source === row.copied && row.copied <= row.destinationTotal;
    if (!match) allMatch = false;
    console.log(
      `${row.table.padEnd(17)} ${String(row.source).padStart(6)}  ${String(row.copied).padStart(6)}  ${String(
        row.destinationTotal
      ).padStart(15)}  ${match ? "yes" : "NO - CHECK THIS"}`
    );
  }
  console.log("----------------------------------------------------------");
  console.log(allMatch ? "\nAll tables copied in full." : "\nSome tables did not fully copy - see above.");

  sqlite.close();
  await pool.end();
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exitCode = 1;
});
