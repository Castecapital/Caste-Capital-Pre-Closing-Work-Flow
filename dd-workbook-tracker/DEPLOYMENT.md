# Deployment Checklist

The recommended setup is a **single service** (Railway or Render both
work): the Express backend serves both the `/api` routes and the built
frontend as static files from one origin, so there's no CORS or
cross-origin cookie configuration to get right. (The app also supports
deploying the frontend and backend as two separate services if you ever
want that - see the bottom of this doc - but single-service is simpler and
is what the walkthroughs below cover.)

## Railway walkthrough (single service)

1. **New Project → Deploy from GitHub repo** and pick
   `castecapital/caste-capital-pre-closing-work-flow`.
2. In the service's **Settings**:
   - **Root Directory**: `dd-workbook-tracker/backend`
   - **Build Command**: `npm install && npm run build` (the `build` script
     builds the frontend into `frontend/dist` - see `backend/package.json`)
   - **Start Command**: `npm start`
3. **Add a Volume** to the service (Settings → Volumes → New Volume).
   Mount it at `/data`. This is the step most likely to be missed and the
   one most likely to cause silent data loss: Railway's default filesystem
   is ephemeral, so without a volume the SQLite database is wiped on every
   redeploy or restart. Railway does **not** attach one automatically - you
   have to add it explicitly.
4. **Set environment variables** (Settings → Variables):
   | Variable | Value |
   | --- | --- |
   | `APP_PASSWORD` | Your chosen shared team password. The backend refuses to start without this. |
   | `DATABASE_PATH` | `/data/app.db` (inside the volume you just mounted) |
   | `NODE_ENV` | `production` |

   `PORT` is injected automatically by Railway - don't set it yourself.
5. **Deploy.** Railway builds and starts the service; watch the deploy log
   for `dd-workbook-tracker backend listening on http://localhost:<port>`.
6. **Generate a domain**: Settings → Networking → Generate Domain. This
   gives you a `*.up.railway.app` URL serving the whole app (login screen,
   API, everything).
7. **Seed the database.** The volume starts empty - `Deploy → View Logs`
   won't show any deal data yet. Run the import once against the deployed
   instance, not your local machine:
   - Open a shell against the running service (Railway CLI: `railway run
     npm run import-workbook` from `dd-workbook-tracker/backend`, or
     Railway's web shell), or
   - If you already have deal data locally in JSON files from before the
     SQLite migration, use `npm run migrate-json-to-sqlite` instead - see
     the main README's "Data layout" section.
8. **Verify**: visit the generated domain, confirm the login screen loads,
   log in with `APP_PASSWORD`, confirm deal data appears, refresh on a
   non-root route (e.g. Master DD Tracker) and confirm it still renders
   (this exercises the catch-all route that lets client-side routing
   survive a hard refresh), and confirm the session survives a reload.

## Render walkthrough (single service)

1. **New → Web Service** and connect the
   `castecapital/caste-capital-pre-closing-work-flow` GitHub repo.
2. In the create form (or **Settings → Build & Deploy** afterward):
   - **Root Directory**: `dd-workbook-tracker/backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build` (the `build` script
     builds the frontend into `frontend/dist` - see `backend/package.json`)
   - **Start Command**: `npm start`
   - **Instance Type**: anything **except Free** - Render's free instances
     don't support persistent disks at all, and you need one for the
     database (next step). Starter is enough for an internal tool.
3. **Add a Disk** (Settings → Disks → Add Disk). Mount path `/data`, 1 GB
   is plenty. This is the step most likely to be missed and the one most
   likely to cause silent data loss: Render's default filesystem is
   ephemeral, so without a disk the SQLite database is wiped on every
   deploy or restart. Render does **not** attach one automatically, and
   (as above) it isn't even available on the Free plan - you have to pick
   a paid instance type and add the disk explicitly.
4. **Set environment variables** (Settings → Environment):
   | Variable | Value |
   | --- | --- |
   | `APP_PASSWORD` | Your chosen shared team password. The backend refuses to start without this. |
   | `DATABASE_PATH` | `/data/app.db` (inside the disk you just mounted) |
   | `NODE_ENV` | `production` |

   `PORT` is injected automatically by Render - don't set it yourself.
5. **Deploy.** Render builds and starts the service; watch the deploy log
   for `dd-workbook-tracker backend listening on http://localhost:<port>`.
   Render assigns a `*.onrender.com` URL automatically - no separate
   "generate domain" step like Railway.
6. **Seed the database.** The disk starts empty. Use the **Shell** tab on
   the service (available on paid instance types) to run the import once
   against the deployed instance, not your local machine:
   ```bash
   cd dd-workbook-tracker/backend  # if the shell doesn't already start there
   npm run import-workbook
   ```
   If you already have deal data locally in JSON files from before the
   SQLite migration, run `npm run migrate-json-to-sqlite` instead - see
   the main README's "Data layout" section.
7. **Verify**: visit the `*.onrender.com` URL, confirm the login screen
   loads, log in with `APP_PASSWORD`, confirm deal data appears, refresh
   on a non-root route (e.g. Master DD Tracker) and confirm it still
   renders (this exercises the catch-all route that lets client-side
   routing survive a hard refresh), and confirm the session survives a
   reload.

## Post-deploy checklist

- [ ] Persistent volume/disk attached and mounted at `/data` (Railway:
      also make sure a volume was actually added, not just referenced;
      Render: also make sure the instance type isn't Free)
- [ ] `DATABASE_PATH=/data/app.db` set
- [ ] `APP_PASSWORD` set
- [ ] `NODE_ENV=production` set
- [ ] Public URL/domain reachable
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
  `APP_PASSWORD`/`DATABASE_PATH`/`NODE_ENV`/volume-or-disk requirements as
  above.
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
