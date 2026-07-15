# Deployment Checklist

This app has two independently deployable pieces: a Node/Express backend
(API + SQLite database) and a static React frontend built with Vite. This
checklist assumes you're deploying to a platform like Render or Railway,
but the same requirements apply anywhere.

## 1. Required environment variables (backend)

| Variable | Required | Notes |
| --- | --- | --- |
| `APP_PASSWORD` | **Yes** | The shared team password (Step 2 auth). The backend refuses to start without it. Set it as a platform env var in your host's dashboard/CLI - never commit it, never put it in a Dockerfile. |
| `DATABASE_PATH` | No (but see below) | Absolute path to the SQLite file. Defaults to `backend/data/app.db` relative to the backend package. On platforms with an ephemeral filesystem, this **must** point inside your persistent volume's mount path (e.g. `/data/app.db`), or all deal data is lost on every redeploy/restart. |
| `PORT` | No | Defaults to `3001`. Most platforms inject this automatically - just make sure your start command doesn't hardcode a different port. |
| `NODE_ENV` | Recommended | Set to `production`. This makes the session cookie `Secure` (HTTPS-only) and is standard practice for Express in production. |

Required environment variables (frontend, build-time only):

| Variable | Required | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Only if frontend and backend are on different origins | e.g. `https://api.yourapp.com`. Leave unset if a reverse proxy serves both frontend and backend from the same origin. Baked into the build at `vite build` time - changing it requires a rebuild, not just a redeploy/restart. |

## 2. Persistent volume for the SQLite database

**This is the step most likely to be missed, and the one most likely to
cause silent data loss.**

Render and Railway (and most container-based platforms) give each deploy a
**fresh, ephemeral filesystem** by default - anything written to disk
during a running instance, including the SQLite file, disappears the
moment the service restarts, redeploys, or scales. Neither platform mounts
a persistent volume automatically; you must configure one explicitly:

- **Render**: add a [Persistent Disk](https://render.com/docs/disks) to
  the backend service, mount it at a path like `/data`, and set
  `DATABASE_PATH=/data/app.db`.
- **Railway**: attach a [Volume](https://docs.railway.com/reference/volumes)
  to the backend service, mount it at a path like `/data`, and set
  `DATABASE_PATH=/data/app.db`.
- **Any other platform**: confirm it offers a persistent volume/disk
  feature and that you've actually attached one to the service running the
  backend - "the container has a filesystem" is not the same thing as "the
  container has a *persistent* filesystem."

After attaching the volume and setting `DATABASE_PATH`, seed it once via
`npm run import-workbook` (or `npm run migrate-json-to-sqlite` if migrating
existing data - see the main README) run against that deployed instance,
not your local machine's database.

## 3. Build & start commands

**Backend** (runs the Express API + owns the SQLite file):

```bash
# build: none needed, it's plain Node
npm install

# start (production - not `npm run dev`, there is no dev script for the backend)
npm start
```

**Frontend** (static assets, served separately from the backend):

```bash
npm install
npm run build      # outputs static files to frontend/dist/ - NOT `npm run dev`
```

Serve `frontend/dist/` as static files from whatever your platform's static
site / CDN feature is (Render Static Site, Railway's static serving,
Vercel/Netlify, an Nginx container, etc.) - `npm run dev` starts a
development server with hot-reload and is not meant for production traffic.

If the frontend is deployed on a different origin than the backend, set
`VITE_API_BASE_URL` to the backend's public URL **before** running
`npm run build` (it's baked into the built JS, not read at runtime).

## 4. Post-deploy checklist

- [ ] `APP_PASSWORD` set on the backend service
- [ ] Persistent volume attached to the backend service, mounted, and
      `DATABASE_PATH` pointing inside it
- [ ] `NODE_ENV=production` set on the backend service
- [ ] Backend reachable and `GET /api/session` (with no cookie) returns
      `401` rather than a 500 or connection error
- [ ] Frontend built with the correct `VITE_API_BASE_URL` (if applicable)
      and served as static files, not via `vite dev`/`vite preview`
- [ ] Logging in with `APP_PASSWORD` from the deployed frontend works and
      the session survives a page reload
- [ ] Deal data seeded (import script or migration script run against the
      deployed database, not left empty)

## 5. Rotating the password

If `APP_PASSWORD` is ever shared outside the immediate team - a screenshot,
a forwarded email, a departing team member - **rotate it**: change the env
var on the backend service and redeploy/restart. Existing sessions signed
with the old password stop verifying immediately (the session cookie is
HMAC-signed using `APP_PASSWORD` itself), so everyone is logged out and
must sign in again with the new password.
