// One-time data migration: copies every row from the old SQLite database
// into the new Postgres database (DATABASE_URL), preserving IDs and
// relationships. Run this once locally against a COPY of the production
// SQLite file, spot-check the results, and only then consider Postgres the
// source of truth - this never touches or deletes the SQLite file.
//
// Postgres is stricter about types than SQLite was (empty-string dates,
// 0/1 vs boolean, etc.) - a row failing here with a clear table/key in the
// error is expected on first run, not a sign the script is broken; fix the
// offending value in the source (or extend the coercion helpers below) and
// re-run against a fresh Postgres database.
//
// The migration logic itself (runSqliteToPostgresMigration) is exported so
// it can be reused as a plain function - see server.js's temporary
// /admin/migrate-to-postgres route - without spawning a subprocess or
// duplicating this file. It deliberately does NOT close the shared `pool`
// from db.js (a long-running caller like the server needs it to stay
// open); only this file's own CLI entry point does that, since it's a
// one-shot process that should exit cleanly afterward.
//
// Usage: node scripts/migrate-sqlite-to-postgres.js [path-to-sqlite-file]
//
// better-sqlite3 isn't a listed dependency for normal operation (the
// running app no longer uses SQLite at all) - it's only present because
// the temporary /admin/migrate-to-postgres route needs it too. Once that
// route is deleted (see server.js), remove the dependency again unless
// this script is still needed.

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SQLITE_PATH = path.join(__dirname, "..", "data", "app.db");

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

export async function runSqliteToPostgresMigration(sqlitePathArg) {
  const sqlitePath = sqlitePathArg || DEFAULT_SQLITE_PATH;
  const sqlite = new Database(sqlitePath, { readonly: true });
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

  try {
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
  } finally {
    sqlite.close();
  }

  const allMatch = summary.every((row) => row.source === row.copied && row.copied <= row.destinationTotal);
  return { sqlitePath, summary, allMatch };
}

function printSummary({ sqlitePath, summary, allMatch }) {
  console.log(`Migrating ${sqlitePath} -> ${process.env.DATABASE_URL ?? "(local fallback Postgres)"}\n`);
  console.log("Table            Source  Copied  Postgres total  Match?");
  console.log("----------------------------------------------------------");
  for (const row of summary) {
    const match = row.source === row.copied && row.copied <= row.destinationTotal;
    console.log(
      `${row.table.padEnd(17)} ${String(row.source).padStart(6)}  ${String(row.copied).padStart(6)}  ${String(
        row.destinationTotal
      ).padStart(15)}  ${match ? "yes" : "NO - CHECK THIS"}`
    );
  }
  console.log("----------------------------------------------------------");
  console.log(allMatch ? "\nAll tables copied in full." : "\nSome tables did not fully copy - see above.");
}

async function main() {
  const result = await runSqliteToPostgresMigration(process.argv[2]);
  printSummary(result);
  await pool.end();
}

// Only run as a CLI when invoked directly (`node scripts/migrate-sqlite-to-postgres.js`),
// not when imported as a module (e.g. by server.js's admin route).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("\nMigration failed:", err.message);
    process.exitCode = 1;
  });
}
