# StackLens deployment and operations

How to provision, deploy, and operate StackLens. Everything runs on free tiers: Vercel Hobby, Neon Postgres free, Upstash Redis free, Resend free, and Sentry free. For system design see [ARCHITECTURE.md](ARCHITECTURE.md); for local development see the [README](../README.md).

The app boots with zero environment variables — `/health` and `/api/analyze` work, and account features return `503 CONFIG_MISSING` — so you can deploy first and configure incrementally.

## 1. Provision services

### Neon Postgres (required for accounts)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string (Connection Details, "Pooled connection"), e.g. `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`.
3. That string is your `DATABASE_URL`.

### GitHub OAuth app (for "Sign in with GitHub")

At [github.com/settings/developers](https://github.com/settings/developers), create an OAuth app:

- Homepage URL: `http://localhost:5173` (dev) or `https://<your-domain>` (prod).
- Authorization callback URL — add **both**:
  - dev: `http://localhost:4000/api/auth/callback/github`
  - prod: `https://<your-domain>/api/auth/callback/github`

Copy the Client ID and Client Secret to `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

### Resend (magic-link email)

1. Sign up at [resend.com](https://resend.com) and verify your domain (or use `onboarding@resend.dev` for tests).
2. Create an API key and set `RESEND_API_KEY`.
3. Set `EMAIL_FROM`, e.g. `StackLens <login@yourdomain.com>`.

### Upstash Redis (optional, recommended on serverless)

Serverless functions are isolated instances, so in-memory rate limits are per instance. For global limits, create a Redis database at [upstash.com](https://upstash.com) and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (both must be set together).

### Cloudflare R2 (nightly backups)

1. Create the bucket `stacklens-backup` (R2, Create bucket).
2. Create an R2 API token (S3-compatible) with Object Write and Delete on that bucket.
3. Note the S3 endpoint (`https://<account>.r2.cloudflarestorage.com`), Access Key ID, and Secret Access Key, and add them as repo secrets `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (see CI/CD).

### Sentry (error tracking, optional)

1. Create two projects at [sentry.io](https://sentry.io): one **Node.js** (server), one **React** (browser).
2. Copy the DSNs to `SENTRY_DSN` (backend env) and `VITE_SENTRY_DSN` (frontend env).
3. Both are errors-only (`tracesSampleRate: 0`) and strictly env-gated: without a DSN the SDK never even loads.

### UptimeRobot (uptime monitoring, optional)

Add an HTTP monitor on `https://<your-domain>/health` (checks every 5 minutes, free tier). The endpoint returns `{"ok":true}` with no dependencies.

## 2. Deploy to Vercel

1. Vercel, **Add New... -> Project**, import the GitHub repository.
2. **Root Directory: leave it as the repo root.** Do **not** set it to `frontend/` — the root `vercel.json` is what builds the SPA *and* deploys `api/index.js` as the API function. Setting the root to `frontend/` silently breaks the entire API.
3. Framework preset: Vite (auto-detected). Build settings come from `vercel.json`:
   - install: `npm install && npm install --prefix frontend`
   - build: `npm run build --prefix frontend`
   - output: `frontend/dist`
   - function: `api/index.js` (`maxDuration` 60)
4. Add environment variables (Project, Settings, Environment Variables) using the table below. Minimum viable deploy: `ALLOWED_ORIGINS=https://<your-domain>`. Full features: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<your-domain>`, `TRUSTED_ORIGINS=https://<your-domain>`, the OAuth and Resend pairs, and the Sentry DSNs.
5. Deploy, then verify: `https://<your-domain>/health` returns `{"ok":true}`, and `/api/analyze?q=octocat` returns a report.

## 3. Environment variables

`.env.example` at the repo root is the annotated source of truth. Nothing is required to boot.

| Variable | Scope | Required | Purpose |
| -------- | ----- | -------- | ------- |
| `ALLOWED_ORIGINS` | backend | prod: yes | CORS allowlist (comma-separated). Include your Vercel domain. `http://localhost:5173` is always allowed. |
| `GITHUB_TOKEN` | backend | recommended | Raises GitHub API rate limits (60 to 5,000 req/h). Keep server-side. |
| `PORT` | backend | no | Default `4000`. Vercel sets it automatically. |
| `RATE_LIMIT_ANON` / `RATE_LIMIT_AUTH` / `RATE_LIMIT_AUTH_ROUTES` | backend | no | Requests/min per client (10 / 100 / 30 by default). The auth-route limit applies to mutating auth endpoints only; session reads are never limited. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | backend | no | Distributed rate limiting (recommended on serverless). Both must be set. |
| `DATABASE_URL` | backend | for accounts | Neon **pooled** connection string. Enables auth, candidates, history, share. |
| `BETTER_AUTH_SECRET` | backend | with `DATABASE_URL` | Session signing key. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | backend | prod: yes | Public base URL of the API (e.g. `https://<your-domain>`). |
| `APP_ORIGIN` | backend | no | SPA origin to return to after failed sign-ins, instead of stranding the visitor on the API origin. |
| `TRUSTED_ORIGINS` | backend | prod: yes | Extra origins allowed to call the auth API (your Vercel domain). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | backend | no | GitHub OAuth app. |
| `RESEND_API_KEY` / `EMAIL_FROM` | backend | no | Magic-link email. |
| `SENTRY_DSN` | backend | no | Server error tracking (errors only). |
| `VITE_SENTRY_DSN` | frontend env | no | Browser error tracking. Public value; `VITE_` prefix required, baked in at build time. |
| `GITHUB_API_BASE` / `TEST_DATABASE_URL` / `MAGIC_LINK_CAPTURE_FILE` | tests only | never prod | Mock server / test DB / email capture hooks. **Do not set on Vercel.** |

## 4. Migrations

```bash
DATABASE_URL="postgresql://..." npm run migrate
```

The script is idempotent. It creates the Better Auth tables (`user`, `session`, `account`, `verification`) plus app tables (`candidates`, `reports`, `share_links`, `schema_migrations`). CI re-runs it on every push to `main` once the `DATABASE_URL` secret is set (see CI/CD).

## 5. CI/CD

Two workflows live in `.github/workflows/`. Both stay green (graceful skips) before any secret is configured.

### `ci.yml`

- **Triggers:** every pull request plus pushes to `main`.
- **Concurrency:** new pushes cancel a PR's in-progress run; main runs are never cancelled.
- **quality job** (ubuntu, Node 20, npm cache):
  1. `npm ci` (root) + `npm ci --prefix frontend`
  2. Lint root + frontend
  3. Build frontend (`tsc -b && vite build`)
  4. `npm test` against a **postgres:16 service container** (`pg_isready` health-checked, `TEST_DATABASE_URL` + `NODE_ENV=test`) — so all **144 tests** run in CI, not just 124.
- **e2e job:** installs Playwright browsers, then runs `npm run test:e2e` (dev server) and `npm run test:e2e:prod` (production-build smoke).
- **migrate job** (needs `quality`, **push to main only**): runs `node db/migrate.js` with the `DATABASE_URL` secret. If the secret is absent it prints `DATABASE_URL secret not set — skipping migration` and exits 0.

### `backup.yml`

- **Triggers:** daily at 03:00 UTC (`cron: 0 3 * * *`) plus manual `workflow_dispatch`.
- If `DATABASE_URL` and the three R2 secrets are set: `pg_dump --no-owner --format=custom` -> `rclone copy` to R2 bucket `stacklens-backup` -> prune dumps older than 14 days (`rclone delete --min-age 14d`).
- If any secret is missing: a `::notice::` message and exit 0 (green skip).
- rclone is configured via `RCLONE_CONFIG_R2_*` env vars (S3-compatible, Cloudflare provider) — no state on the runner.

### Required repo secrets

Settings, Secrets and variables, Actions, **New repository secret**:

| Secret | Used by | Value |
| ------ | ------- | ----- |
| `DATABASE_URL` | ci.yml (migrate), backup.yml | Neon pooled connection string |
| `R2_ENDPOINT` | backup.yml | `https://<account>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | backup.yml | R2 API token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | backup.yml | R2 API token Secret Access Key |

### Branch protection (manual, recommended)

Settings, Branches, add a branch protection rule for `main`:

1. **Require status checks to pass before merging** — select the **quality** job; enable "Require branches to be up to date before merging".
2. **Require linear history** (and use "Squash and merge" in the merge dialog).
3. Optionally: restrict pushes that match no PR to `main`.

## 6. Backups and restore

Backups land in R2 as `stacklens-backup/stacklens-YYYY-MM-DD.dump` (custom format, `--no-owner`). To restore:

```bash
# Download from R2 (rclone remote configured as in backup.yml)
rclone copy r2:stacklens-backup/ ./backups/

# Restore into a Postgres database (Neon or local)
pg_restore --no-owner --dbname "postgresql://user:pass@host/db" ./backups/stacklens-2026-09-16.dump
```

`pg_restore` is safe on a fresh database (migrations already create the tables; rows are appended). To fully replace existing data, add `--clean --if-exists`. Verify a restore against a scratch Neon branch before trusting it.

## 7. Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| Browser console: CORS error on `/api/*` | The request isn't same-origin. In dev, always use the Vite server (5173), which proxies `/api`. In prod, make sure you deployed the **repo root** (not `frontend/`) so `/api/*` rewrites to the function, and set `ALLOWED_ORIGINS` to your domain. |
| `503 CONFIG_MISSING` on `/api/auth/*`, `/api/candidates`, `/api/history`, `/api/share` | The feature's env isn't configured on the server: `DATABASE_URL` + `BETTER_AUTH_SECRET` for auth and the signed-in features. Add them (Vercel, Settings, Environment Variables) and redeploy. |
| `503 CONFIG_MISSING` on `GET /api/share/:token` | `DATABASE_URL` missing — public share lookups still need the DB. |
| `429 RATE_LIMITED` "GitHub API rate limit hit" | Anonymous GitHub API quota (60/h) exhausted. Set `GITHUB_TOKEN` on the backend. |
| Auth cookie issues after deploy (sign-in loops) | `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` must both be `https://<your-domain>`, and the GitHub OAuth callback URL must match (see provisioning, GitHub OAuth app). |
| SQL error `relation "..." does not exist` | Migrations not applied: run `npm run migrate` with `DATABASE_URL`, or set the `DATABASE_URL` repo secret so CI applies them on push to main. |
| Frontend builds but shows stale/missing env behavior | Only `VITE_`-prefixed vars reach the browser bundle, and they're **baked in at build time** — change them in Vercel, then **redeploy**. |
