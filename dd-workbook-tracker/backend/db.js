// PostgreSQL storage. A connection pool, not a single client - this is a
// web service handling concurrent requests, and pg.Pool hands out/reuses
// connections per query rather than serializing everything through one.
//
// DATABASE_URL is read from the environment (set to a Render Postgres
// instance's *Internal* Database URL in production - see DEPLOYMENT.md).
// If it's unset, this falls back to a local Postgres instance (or the
// docker-compose Postgres container - see README) so local dev doesn't
// require a deployed database to test against.

import pg from "pg";
import { runMigrations } from "./migrations/migrate.js";

const LOCAL_FALLBACK_URL = "postgres://postgres:postgres@localhost:5432/dd_workbook_tracker";
const DATABASE_URL = process.env.DATABASE_URL || LOCAL_FALLBACK_URL;

if (!process.env.DATABASE_URL) {
  console.warn(
    `DATABASE_URL not set - falling back to a local Postgres instance at ${LOCAL_FALLBACK_URL}. ` +
      `Set DATABASE_URL for anything beyond local development (see .env.example / README).`
  );
}

// node-postgres returns `date` columns as JS Date objects by default, which
// JSON.stringify()s as a full UTC timestamp ("...T00:00:00.000Z") instead of
// the plain "YYYY-MM-DD" string the frontend expects (date inputs, item
// dates, deal_config dates). Passing the raw text straight through avoids
// both the format change and any timezone-shift-by-a-day risk from
// interpreting a date-only value as a UTC midnight instant.
pg.types.setTypeParser(1082 /* date */, (value) => value);

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  // Render (and most managed Postgres hosts) require SSL on any connection
  // string you'd actually set DATABASE_URL to; the local fallback above
  // never needs it. rejectUnauthorized: false because Render's Postgres
  // uses a certificate not in Node's default trust store.
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

await runMigrations(pool);
