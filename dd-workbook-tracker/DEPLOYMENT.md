# Deployment Checklist

The recommended setup is a **single service** (Railway or Render both
work) backed by a **managed Postgres database**: the Express backend
serves both the `/api` routes and the built frontend as static files from
one origin, so there's no CORS or cross-origin cookie configuration to get
right, and deal data lives in Postgres rather than on the service's own
disk. That means no persistent volume/disk to attach and no risk of data
loss on redeploy, restart, or (on Render's free tier) spin-down - the
database is a separate, always-persistent resource. (The app also supports
deploying the frontend and backend as two separate services if you ever
want that - see the bottom of this doc - but single-service is simpler and
is what the walkthroughs below cover.)

## Railway walkthrough (single service + managed Postgres)

1. **New Project → Deploy from GitHub repo** and pick
   `castecapital/caste-capital-pre-closing-work-flow`.
2. **Add a Postgres database**: in the same project, **New → Database →
   Add PostgreSQL**. Railway provisions it and exposes a `DATABASE_URL`
   variable on the Postgres service itself.
3. In the **backend service's** Settings:
   - **Root Directory**: `dd-workbook-tracker/backend`
   - **Build Command**: `npm install && npm run build` (the `build` script
     builds the frontend into `frontend/dist` - see `backend/package.json`)
   - **Start Command**: `npm start`
4. **Set environment variables** (Settings → Variables) on the **backend
   service**:
   | Variable | Value |
   | --- | --- |
   | `APP_PASSWORD` | Your chosen shared team password. The backend refuses to start without this. |
   | `DATABASE_URL` | Reference the Postgres service's connection string: `${{Postgres.DATABASE_URL}}` (Railway's variable-reference syntax - pick it from the variable autocomplete rather than typing it by hand). |
   | `NODE_ENV` | `production` |

   `PORT` is injected automatically by Railway - don't set it yourself.
5. **Deploy.** Railway builds and starts the service; watch the deploy log
   for `Applied migration: 001_init.sql` (schema created automatically on
   first boot - see "Migrations" in the main README) followed by
   `dd-workbook-tracker backend listening on http://localhost:<port>`.
6. **Generate a domain**: Settings → Networking → Generate Domain. This
   gives you a `*.up.railway.app` URL serving the whole app (login screen,
   API, everything).
7. **Seed the database.** The schema exists (migrations ran automatically)
   but it's empty - no deals yet. Run the import once against the deployed
   instance, not your local machine:
   - Open a shell against the running service (Railway CLI: `railway run
     npm run import-workbook` from `dd-workbook-tracker/backend`, or
     Railway's web shell), or
   - If you have deal data in an old SQLite file from before the Postgres
     migration, run `npm run migrate-sqlite-to-postgres <path-to-file>`
     instead - see the main README's "Data layout" section.
8. **Verify**: visit the generated domain, confirm the login screen loads,
   log in with `APP_PASSWORD`, confirm deal data appears, refresh on a
   non-root route (e.g. Master DD Tracker) and confirm it still renders
   (this exercises the catch-all route that lets client-side routing
   survive a hard refresh), and confirm the session survives a reload.

## Render walkthrough (single service + managed Postgres)

1. **New → Web Service** and connect the
   `castecapital/caste-capital-pre-closing-work-flow` GitHub repo.
2. **Provision (or reuse) a Render Postgres instance**: New → PostgreSQL,
   or use one you already have. Once it's up, open it and copy the
   **Internal Database URL** - not the External one. The internal URL only
   works from services in the same Render region/private network, which
   is exactly where your Web Service runs, and it's faster and doesn't
   count against external connection limits. (The External Database URL
   would also work, e.g. for connecting from your laptop to inspect data,
   but don't use it as the app's `DATABASE_URL`.)
3. In the Web Service's create form (or **Settings → Build & Deploy**
   afterward):
   - **Root Directory**: `dd-workbook-tracker/backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build` (the `build` script
     builds the frontend into `frontend/dist` - see `backend/package.json`)
   - **Start Command**: `npm start`
   - **Instance Type**: Free is fine now - unlike the old SQLite-on-disk
     setup, there's no persistent disk requirement forcing a paid plan.
4. **Set environment variables** (Settings → Environment):
   | Variable | Value |
   | --- | --- |
   | `APP_PASSWORD` | Your chosen shared team password. The backend refuses to start without this. |
   | `DATABASE_URL` | The Postgres instance's **Internal Database URL** from step 2. |
   | `NODE_ENV` | `production` |

   `PORT` is injected automatically by Render - don't set it yourself.
5. **Deploy.** Render builds and starts the service; watch the deploy log
   for `Applied migration: 001_init.sql` (schema created automatically on
   first boot - see "Migrations" in the main README) followed by
   `dd-workbook-tracker backend listening on http://localhost:<port>`.
   Render assigns a `*.onrender.com` URL automatically - no separate
   "generate domain" step like Railway.
6. **Seed the database.** The schema exists (migrations ran automatically)
   but it's empty - no deals yet. Use the **Shell** tab on the Web Service
   to run the import once against the deployed instance, not your local
   machine:
   ```bash
   cd dd-workbook-tracker/backend  # if the shell doesn't already start there
   npm run import-workbook
   ```
   If you have deal data in an old SQLite file from before the Postgres
   migration, run `npm run migrate-sqlite-to-postgres <path-to-file>`
   instead (you'd need to get that file onto the instance first, e.g. via
   the External Database URL from your laptop) - see the main README's
   "Data layout" section.
7. **Verify**: visit the `*.onrender.com` URL, confirm the login screen
   loads, log in with `APP_PASSWORD`, confirm deal data appears, refresh
   on a non-root route (e.g. Master DD Tracker) and confirm it still
   renders (this exercises the catch-all route that lets client-side
   routing survive a hard refresh), and confirm the session survives a
   reload.

## Cutting over an existing SQLite deployment to Postgres

If the app is **already live** on Render or Railway with real deal data on
the old SQLite-on-disk setup, do this instead of a plain first deploy - it
migrates the *live* database (with whatever edits the team has made since
launch), not just re-seeds from the source workbook, and keeps the disk
attached just long enough to read from it one last time:

1. **Set `DATABASE_URL` first**, before deploying the new code - point it
   at your already-provisioned Postgres instance (Render: its Internal
   Database URL). Leave the existing `DATABASE_PATH` env var and disk/volume
   in place for now; the new code doesn't read `DATABASE_PATH` anymore, but
   the disk needs to stay attached so its SQLite file is still reachable
   in the next step.
2. **Deploy this code** (the branch/commit with the Postgres migration).
   Watch the deploy log for the migrations applying
   (`Applied migration: 001_init.sql`) and the server starting. At this
   point Postgres has the right schema but is **empty** - the live app
   will show zero deals until step 3 finishes. For a small internal team
   this is usually a few minutes; give them a heads-up if the timing
   matters.
3. **Open a shell on the now-running service** (Render: the Shell tab;
   Railway: `railway run` or the web shell) and run the data migration
   against the disk's existing file:
   ```bash
   cd dd-workbook-tracker/backend  # if the shell doesn't already start there
   npm run migrate-sqlite-to-postgres /data/app.db   # adjust to your actual disk mount path + DATABASE_PATH value
   ```
   Check your service's Disks/Volumes settings first if you're not sure of
   the exact path - it's whatever `DATABASE_PATH` was set to before this
   migration.
4. **Confirm the summary** printed at the end shows every table's
   Source/Copied/Postgres-total counts matching, ending in
   "All tables copied in full." A row failing with a clear table/key in
   the error is a known, expected failure mode (Postgres rejecting a
   malformed value SQLite tolerated, e.g. an empty-string date) - fix the
   offending value and re-run against a truncated Postgres database rather
   than guessing.
5. **Verify in the browser**: refresh the live app, confirm real deal data
   now appears (not just the deal-1 template), spot-check a few items'
   comments/history/status against what the team remembers being there,
   and confirm login still works.
6. **Only then**, detach/remove the now-unused disk (Settings → Disks) and
   the `DATABASE_PATH` env var - the disk was serving as the source of
   truth until step 3 confirmed the copy, so don't remove it earlier than
   this even though the new code stopped reading it at step 2.

## Post-deploy checklist

- [ ] Postgres instance provisioned (Railway plugin or Render Postgres)
- [ ] `DATABASE_URL` set on the backend service to that instance's
      connection string (Render: the **Internal** URL specifically)
- [ ] `APP_PASSWORD` set
- [ ] `NODE_ENV=production` set
- [ ] Public URL/domain reachable
- [ ] Deploy log shows migrations applying successfully (no
      `Migration ... failed` errors) before the "listening on" line
- [ ] Login screen loads at `/`, and `GET /api/session` with no cookie
      returns `401` rather than a 500 or connection error
- [ ] Logging in works and the session survives a page reload
- [ ] A hard refresh on a non-root route (e.g. `/master-dd-tracker`) still
      renders the app, not a 404 or blank page
- [ ] Deal data seeded (import or migration script run against the
      deployed database, not left empty)

## Rotating the password

If `APP_PASSWORD` is ever shared outside the immediate team - a
screenshot, a forwarded email, a departing team member - **rotate it**:
change the env var on your hosting platform (Railway or Render) and
redeploy/restart. Existing sessions signed with the old password stop
verifying immediately (the session cookie is HMAC-signed using
`APP_PASSWORD` itself), so everyone is logged out and must sign in again
with the new password.

## Alternative: separate frontend/backend services

The app also supports deploying the frontend and backend as two
independent services (e.g. if you want to scale or redeploy them
separately, or put the frontend on a CDN-backed static host). This needs
extra configuration the single-service setup above avoids entirely:

- Deploy `dd-workbook-tracker/backend` as its own service (Railway
  service or Render Web Service). Skip its `build` script (nothing to
  build) - Build Command: `npm install`, Start Command: `npm start`. Same
  `APP_PASSWORD`/`DATABASE_URL`/`NODE_ENV` requirements as above.
- Deploy `dd-workbook-tracker/frontend` as a static site (Railway's
  static hosting, or Render's **Static Site** service type - not a Web
  Service). Build Command: `npm install && npm run build`, publish
  directory: `dist`. Before building, set `VITE_API_BASE_URL` to the
  backend service's public URL (e.g. `https://api-production.up.railway.app`
  or `https://api.onrender.com`) - it's baked into the JS bundle at build
  time, so changing it later requires a rebuild, not just a redeploy.
- The backend's CORS is already configured to reflect the request origin
  with credentials enabled (`server.js`), so the session cookie will flow
  correctly across the two origins once `VITE_API_BASE_URL` is set - no
  further backend changes needed.
