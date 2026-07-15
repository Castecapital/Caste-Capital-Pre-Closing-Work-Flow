// ============================================================================
// TEMPORARY — FOR ONE-TIME MIGRATION, DELETE AFTER USE.
//
// Two routes doing the same underlying migration, for different situations:
//   POST /admin/migrate-to-postgres  - X-Migration-Secret header, JSON body
//   GET  /admin/migrate-to-postgres  - ?secret= query param, HTML body (so
//                                      it's readable pasted straight into a
//                                      browser tab, no curl/terminal needed)
// Both run the exact same SQLite -> Postgres data migration as
// `npm run migrate-sqlite-to-postgres`, over HTTP instead of a shell, for
// platforms/plans where a shell isn't convenient. Once the production
// cutover (see DEPLOYMENT.md) is done and confirmed, delete this file and
// remove its imports + route registrations from server.js. Also remove
// better-sqlite3 from package.json if nothing else needs it (see the
// comment at the top of scripts/migrate-sqlite-to-postgres.js).
//
// Neither route ever logs the secret it was given (server.js has no
// request-logging middleware to begin with, and nothing in this file calls
// console.log/console.error with req.query or req.get(...) - only the
// migration's own table/row summary, which never contains the secret).
// ============================================================================

import crypto from "crypto";
import { runSqliteToPostgresMigration, formatMigrationSummaryText } from "./scripts/migrate-sqlite-to-postgres.js";

function constantTimeEqual(a, b) {
  const digestA = crypto.createHash("sha256").update(a).digest();
  const digestB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

// No secret configured means these routes can never be legitimately called -
// fail closed rather than comparing against an empty/undefined value.
function isAuthorized(provided) {
  const secret = process.env.MIGRATION_SECRET;
  return !!secret && !!provided && constantTimeEqual(String(provided), String(secret));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderHtmlPage(title, bodyText) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><pre>${escapeHtml(bodyText)}</pre></body>
</html>`;
}

export async function adminMigrateToPostgres(req, res) {
  if (!isAuthorized(req.get("X-Migration-Secret"))) {
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

export async function adminMigrateToPostgresGet(req, res) {
  if (!isAuthorized(req.query.secret)) {
    return res.status(401).type("text/plain").send("Unauthorized");
  }

  try {
    const result = await runSqliteToPostgresMigration(process.env.DATABASE_PATH);
    res
      .status(200)
      .type("html")
      .send(renderHtmlPage("Migration complete", formatMigrationSummaryText(result)));
  } catch (err) {
    res
      .status(500)
      .type("html")
      .send(renderHtmlPage("Migration failed", `Migration failed: ${err.message}`));
  }
}
