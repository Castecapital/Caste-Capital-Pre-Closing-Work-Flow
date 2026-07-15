// ============================================================================
// TEMPORARY — FOR ONE-TIME MIGRATION, DELETE AFTER USE.
//
// POST /admin/migrate-to-postgres runs the exact same SQLite -> Postgres
// data migration as `npm run migrate-sqlite-to-postgres`, over HTTP instead
// of a shell, for platforms/plans where a shell isn't convenient. Once the
// production cutover (see DEPLOYMENT.md) is done and confirmed, delete this
// file and remove its import + route registration from server.js. Also
// remove better-sqlite3 from package.json if nothing else needs it (see the
// comment at the top of scripts/migrate-sqlite-to-postgres.js).
// ============================================================================

import crypto from "crypto";
import { runSqliteToPostgresMigration } from "./scripts/migrate-sqlite-to-postgres.js";

function constantTimeEqual(a, b) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

export async function adminMigrateToPostgres(req, res) {
  const secret = process.env.MIGRATION_SECRET;
  const provided = req.get("X-Migration-Secret");

  // No secret configured means this route can never be legitimately called -
  // fail closed rather than comparing against an empty/undefined value.
  if (!secret || !provided || !constantTimeEqual(String(provided), String(secret))) {
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const { sqlitePath, summary, allMatch } = await runSqliteToPostgresMigration(process.env.DATABASE_PATH);
    res.json({
      sqlitePath,
      allMatch,
      tables: summary.map((row) => ({
        ...row,
        match: row.source === row.copied && row.copied <= row.destinationTotal,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
