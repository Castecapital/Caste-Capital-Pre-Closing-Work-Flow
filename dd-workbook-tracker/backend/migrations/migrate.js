// Tiny migration runner: numbered .sql files in this directory, tracked in
// a schema_migrations table so each one applies at most once. Deliberately
// not a dependency (node-pg-migrate etc.) - the project's small enough that
// "read the .sql files in order, apply what's new, record it" is the whole
// feature set that's needed, and it keeps migrations as plain, readable SQL.
//
// Runs automatically on every server startup (see db.js) - safe because
// it's idempotent, and it means a fresh deploy never needs a separate
// manual migration step. Also runnable directly via `npm run migrate`.

import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (rows.length) continue;

    const sql = readFileSync(path.join(__dirname, file), "utf-8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}
