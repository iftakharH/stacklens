# StackLens

**See the developer behind the repositories.**

StackLens analyzes a GitHub profile from a link or username and generates a concise developer evaluation report — overview, stack, top repos, scores, and actionable insights. Recruiters get an instant read on a candidate; developers get an honest mirror of their public work.

Zero-config by design: the app boots and serves `/health` + `/api/analyze` with **no environment variables at all**. Accounts, saved candidates, history, and share links unlock as you add configuration, and unconfigured features degrade to clear `503 CONFIG_MISSING` responses instead of crashing.

---

## Features

- **Profile analysis** — paste a GitHub profile URL or username, get an instant report.
- **Developer overview** — avatar, bio, followers, repos, account age, last activity.
- **Stack analysis** — primary/secondary languages with a weighted distribution chart.
- **Repository highlights** — top repositories by stars with descriptions and metadata.
- **Developer score** — activity, stack diversity, and project quality (0–10) plus an overall score and hireability label.
- **Rule-based insights** — short, actionable suggestions; no AI fluff.
- **Accounts (optional)** — sign in with GitHub OAuth or an email magic link (Better Auth).
- **Saved candidates** — bookmark developers with notes.
- **History** — every analysis you run while signed in is persisted and re-viewable.
- **Share links** — publish any stored report on a public URL with expiry + view counts.
- **Dark & light mode**, responsive layout for mobile → large screens.

---

## Architecture

Deploys as a **single Vercel project**: the SPA is static output and the Express app is one serverless function, wired by the repo-root `vercel.json`.

```
                        ┌───────────────────────────────────────────────┐
                        │                  VERCEL                       │
                        │              (repo root)                     │
  Browser               │                                               │
  ─────────────────────▶│  frontend/dist      React 19 SPA (Vite)      │
   /  /saved            │    /            analyze                      │
   /history             │    /saved       saved candidates             │
   /share/:token        │    /history     persisted reports            │
                        │    /share/:tok  public shared report         │
                        │                                               │
                        │  api/index.js       Express serverless fn    │
                        │    helmet · CORS allowlist · rate limits     │
                        │    /api/analyze · /api/auth/* · candidates · │
                        │    history · share                           │
                        │                                               │
                        │  vercel.json rewrites:                       │
                        │    /api/*  ──▶ api/index.js                  │
                        │    /health ──▶ api/index.js                  │
                        │    anything else ──▶ index.html (SPA)        │
                        └──────┬───────────┬──────────┬─────────┬──────┘
                               │           │          │         │
                  ┌────────────▼──┐  ┌─────▼─────┐ ┌──▼──────┐ ┌▼──────────┐
                  │ Neon Postgres │  │ GitHub    │ │ Resend  │ │ Upstash   │
                  │ (pooled conn) │  │ REST API  │ │ magic-  │ │ Redis     │
                  │ user/session/ │  │ (axios)   │ │ link    │ │ (rate     │
                  │ candidates/   │  └───────────┘ │ email   │ │  limits,  │
                  │ reports/      │                └─────────┘ │  optional)│
                  │ share_links   │                            └───────────┘
                  └───────────────┘
                  Sentry (env-gated): server errors via SENTRY_DSN,
                  browser errors via VITE_SENTRY_DSN — errors only, $0 tier.
```

| Layer | Stack |
| ----- | ----- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, react-router |
| Backend | Node.js 20+, Express 5 (one Vercel serverless function) |
| Auth | Better Auth — GitHub OAuth + magic link, env-gated |
| Data | PostgreSQL (Neon, pooled) + GitHub REST API |
| Email | Resend (magic links, optional) |
| Rate limiting | In-memory (default) or Upstash Redis (optional, for serverless) |
| Errors | Sentry, env-gated, errors-only |
| CI/CD | GitHub Actions — quality gate + migrations + daily R2 backups |

---

## Project structure

```
stacklens/
├── api/
│   ├── index.js          # Express app: health, analyze, auth mount, routers
│   ├── candidates.js     # Saved candidates (signed in)
│   ├── history.js        # Persisted reports (signed in)
│   └── share.js          # Share links (create/revoke private, view public)
├── lib/                  # errors, rateLimit, github, validation, report,
│                         # db, auth, session, reportStore
├── db/
│   ├── migrate.js        # Applies db/migrations/*.sql  (npm run migrate)
│   └── migrations/
├── scripts/              # capture-fixtures, generate-goldens (dev tooling)
├── test/                 # Vitest: unit (engine, validation) + integration
│                         # (api, auth, features) with golden fixtures
├── .github/workflows/    # ci.yml (lint/build/test + migrate), backup.yml
├── frontend/             # Vite + React 19 + TS SPA (own eslint/tailwind)
├── vercel.json           # function + rewrites (api, health, SPA fallback)
├── server.js             # Local dev boot shim
└── package.json          # Root: scripts, deps, engines node>=20
```

---

## Quickstart (local dev)

Prerequisites: **Node 20+**, npm. **Docker** is optional — only needed to run the DB-gated integration tests.

```bash
# 1. Install (root + frontend)
npm install
npm --prefix frontend install

# 2. Run the API  (http://localhost:4000)
npm run dev

# 3. In a second terminal, run the SPA  (http://localhost:5173)
npm --prefix frontend run dev
```

The Vite dev server proxies `/api/*` to `localhost:4000`, so the app works with zero env vars. Open http://localhost:5173 and analyze a profile.

### Tests

```bash
# Without a database: 124 pass, 20 skipped (DB suites skip cleanly)
npm test

# With a real Postgres: all 144 tests run
docker run -d --name stacklens-test-pg -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_DB=stacklens_test -p 5432:5432 postgres:16-alpine

TEST_DATABASE_URL=postgresql://postgres:testpass@127.0.0.1:5432/stacklens_test npm test
# (PowerShell: $env:TEST_DATABASE_URL='...'; npm test)

# Clean up
docker rm -f stacklens-test-pg
```

The integration suites run the real migration script against `TEST_DATABASE_URL` and wipe rows between cases — never point it at production.

### Lint

```bash
npm run lint                     # root: eslint (api/, lib/, db/, scripts/, test/)
npm --prefix frontend run lint   # frontend: eslint + TS-aware rules
```

---

## Environment variables

Root `.env.example` documents everything and is the source of truth. Nothing is required to boot.

| Variable | Scope | Required | Purpose |
| -------- | ----- | -------- | ------- |
| `ALLOWED_ORIGINS` | backend | prod: yes | CORS allowlist (comma-separated). Include your Vercel domain. `http://localhost:5173` is always allowed. |
| `GITHUB_TOKEN` | backend | recommended | Raises GitHub API rate limits (60→5000/h). Keep server-side. |
| `PORT` | backend | no | Default `4000`. Vercel sets it automatically. |
| `RATE_LIMIT_ANON` / `RATE_LIMIT_AUTH` / `RATE_LIMIT_AUTH_ROUTES` | backend | no | Requests/min per client (10 / 100 / 5 by default). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | backend | no | Distributed rate limiting (recommended on serverless). Both must be set. |
| `DATABASE_URL` | backend | for accounts | Neon **pooled** connection string. Enables auth, candidates, history, share. |
| `BETTER_AUTH_SECRET` | backend | with `DATABASE_URL` | Session signing key. `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | backend | prod: yes | Public base URL of the API (e.g. `https://<your-domain>`). |
| `TRUSTED_ORIGINS` | backend | prod: yes | Extra origins allowed to call the auth API (your Vercel domain). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | backend | no | GitHub OAuth app → "Sign in with GitHub". |
| `RESEND_API_KEY` / `EMAIL_FROM` | backend | no | Magic-link email. |
| `SENTRY_DSN` | backend | no | Server error tracking (errors only). |
| `VITE_SENTRY_DSN` | frontend env | no | Browser error tracking. Public value; `VITE_` prefix required. |
| `GITHUB_API_BASE` / `TEST_DATABASE_URL` / `MAGIC_LINK_CAPTURE_FILE` | tests only | never prod | Mock server / test DB / email capture hooks. **Do not set on Vercel.** |

---

## Deployment runbook (all free tiers)

### 1. Neon Postgres

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string (Connection Details → "Pooled connection"), e.g. `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`.
3. That string is your `DATABASE_URL`.

### 2. Apply migrations

```bash
DATABASE_URL="postgresql://..." npm run migrate
```

Idempotent — creates the Better Auth tables (`user`, `session`, `account`, `verification`) plus app tables (`candidates`, `reports`, `share_links`, `schema_migrations`). CI re-runs it on every push to `main` once the `DATABASE_URL` secret is set (see CI/CD).

### 3. GitHub OAuth app

[github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**:

- Homepage URL: `http://localhost:5173` (dev) / `https://<your-domain>` (prod)
- Authorization callback URL — add **both**:
  - dev: `http://localhost:4000/api/auth/callback/github`
  - prod: `https://<your-domain>/api/auth/callback/github`

Copy Client ID + Client Secret → `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

### 4. Resend (magic-link email)

1. Sign up at [resend.com](https://resend.com), verify your domain (or use `onboarding@resend.dev` for tests).
2. Create an API key → `RESEND_API_KEY`.
3. Set `EMAIL_FROM` (e.g. `StackLens <login@yourdomain.com>`).

### 5. Upstash Redis (optional, recommended on serverless)

Serverless functions are isolated instances, so in-memory rate limits are per-instance. For global limits: create a Redis database at [upstash.com](https://upstash.com) → set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

### 6. Cloudflare R2 (backups)

1. Create the bucket `stacklens-backup` (R2 → Create bucket).
2. Create an R2 API token (S3-compatible) with Object Write & Delete on that bucket.
3. Note the S3 endpoint (`https://<account>.r2.cloudflarestorage.com`), Access Key ID, and Secret Access Key → add as repo secrets `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (see CI/CD).

### 7. UptimeRobot (uptime monitoring)

Add an HTTP monitor on `https://<your-domain>/health` (checks every 5 min, free tier). The endpoint returns `{"ok":true}` with no dependencies.

### 8. Sentry (error tracking, optional)

1. Create two projects at [sentry.io](https://sentry.io): one **Node.js** (server), one **React** (browser).
2. Copy the DSNs → `SENTRY_DSN` (backend env) and `VITE_SENTRY_DSN` (frontend env).
3. Both are errors-only (`tracesSampleRate: 0`) and strictly env-gated: without the DSN the SDK never even loads.

---

## Deploy to Vercel — CRITICAL setup

1. Vercel → **Add New… → Project** → Import the GitHub repo.
2. **Root Directory: leave it as the repo root (empty).** Do **NOT** set it to `frontend/` — the root `vercel.json` is what builds the SPA *and* deploys `api/index.js` as the API function. Setting the root to `frontend/` silently breaks the entire API.
3. Framework preset: Vite (auto-detected). Build settings come from `vercel.json`:
   - install: `npm install && npm install --prefix frontend`
   - build: `npm run build --prefix frontend`
   - output: `frontend/dist`
   - function: `api/index.js` (maxDuration 60s)
4. Add the environment variables (Project → Settings → Environment Variables) — use the table above. Minimum viable deploy: `ALLOWED_ORIGINS=https://<your-domain>`. Full features: add `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<your-domain>`, `TRUSTED_ORIGINS=https://<your-domain>`, OAuth + Resend pairs, and the Sentry DSNs.
5. Deploy, then verify: `https://<your-domain>/health` returns `{"ok":true}`, and `/api/analyze?q=octocat` returns a report.

**Retiring the old setup:** after cutover you can delete the old Render web service and the old frontend-only Vercel project (the one rooted at `frontend/` with rewrites to Render). First update the GitHub OAuth callback URL to the new domain (step 3 above) so sign-in keeps working.

---

## CI/CD

Two workflows live in `.github/workflows/`. Both stay green (graceful skips) before any secret is configured.

### `ci.yml`

- **Triggers:** every pull request + pushes to `main`.
- **Concurrency:** new pushes cancel a PR's in-progress run; main runs are never cancelled.
- **quality job** (ubuntu, Node 20, npm cache):
  1. `npm ci` (root) + `npm ci --prefix frontend`
  2. Lint root + frontend
  3. Build frontend (`tsc -b && vite build`)
  4. `npm test` against a **postgres:16 service container** (`pg_isready` health-checked, `TEST_DATABASE_URL` + `NODE_ENV=test`) — so all **144 tests** run in CI, not just 124.
- **migrate job** (needs `quality`, **push to main only**): runs `node db/migrate.js` with the `DATABASE_URL` secret. If the secret is absent it prints `DATABASE_URL secret not set — skipping migration` and exits 0.

### `backup.yml`

- **Triggers:** daily at 03:00 UTC (`cron: 0 3 * * *`) + manual `workflow_dispatch`.
- If `DATABASE_URL` and the three R2 secrets are set: `pg_dump --no-owner --format=custom` → `rclone copy` to R2 bucket `stacklens-backup` → prune dumps older than 14 days (`rclone delete --min-age 14d`).
- If any secret is missing: `::notice::` message + exit 0 (green skip).
- rclone is configured via `RCLONE_CONFIG_R2_*` env vars (S3/Cloudflare provider) — no state on the runner.

### Required repo secrets

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Used by | Value |
| ------ | ------- | ----- |
| `DATABASE_URL` | ci.yml (migrate), backup.yml | Neon pooled connection string |
| `R2_ENDPOINT` | backup.yml | `https://<account>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | backup.yml | R2 API token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | backup.yml | R2 API token Secret Access Key |

### Branch protection (manual, recommended)

Settings → Branches → Add branch protection rule for `main`:

1. **Require status checks to pass before merging** → select the **quality** job; enable "Require branches to be up to date before merging".
2. **Require linear history** (and use "Squash and merge" in the merge dialog).
3. Optionally: restrict pushes that match no PR to `main`.

---

## Backups & restore

Backups land in R2 as `stacklens-backup/stacklens-YYYY-MM-DD.dump` (custom format, `--no-owner`). To restore:

```bash
# Download from R2 (rclone remote configured as in backup.yml)
rclone copy r2:stacklens-backup/ ./backups/

# Restore into a Postgres database (Neon or local)
pg_restore --no-owner --dbname "postgresql://user:pass@host/db" ./backups/stacklens-2026-09-16.dump
```

`pg_restore` is safe on a fresh database (migrations already create the tables; rows are appended). To fully replace existing data, add `--clean --if-exists`. Verify a restore against a scratch Neon branch before trusting it.

---

## Troubleshooting

| Symptom | Cause & fix |
| ------- | ----------- |
| Browser console: CORS error on `/api/*` | The request isn't same-origin. In dev, always use the Vite server (5173) which proxies `/api`. In prod, make sure you deployed the **repo root** (not `frontend/`) so `/api/*` rewrites to the function, and set `ALLOWED_ORIGINS` to your domain. |
| `503 CONFIG_MISSING` on `/api/auth/*`, `/api/candidates`, `/api/history`, `/api/share` | The feature's env isn't configured on the server: `DATABASE_URL` + `BETTER_AUTH_SECRET` for auth/features. Add them (Vercel → Settings → Environment Variables) and redeploy. |
| `503 CONFIG_MISSING` on `GET /api/share/:token` | `DATABASE_URL` missing — public share lookups still need the DB. |
| `429 RATE_LIMITED` "GitHub API rate limit hit" | Anonymous GitHub API quota (60/h) exhausted. Set `GITHUB_TOKEN` on the backend. |
| Auth cookie issues after deploy (sign-in loops) | `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` must both be `https://<your-domain>`, and the GitHub OAuth callback URL must match (step 3). |
| SQL error `relation "..." does not exist` | Migrations not applied: run `npm run migrate` with `DATABASE_URL`, or set the `DATABASE_URL` repo secret so CI applies them on push to main. |
| Frontend builds but shows stale/missing env behavior | Only `VITE_`-prefixed vars reach the browser bundle, and they're **baked in at build time** — change them in Vercel, then **redeploy**. |

---

## License

ISC.
