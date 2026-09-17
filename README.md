# StackLens

StackLens turns a public GitHub profile into a one-page developer report: language mix, activity, project quality, an overall 0-10 score, a hireability band, repository highlights, and rule-based insights. Recruiters get a quick read on a candidate; developers get a mirror of their public work. Analysis needs no account; optional accounts add saved candidates, report history, and public share links.

Live: https://stacklens-purple.vercel.app

## What it does

- Analyzes any public GitHub profile by username or profile URL; both forms are accepted.
- Overview: avatar, name, bio, followers, public repos, account age, last activity.
- Language mix weighted by repository size, colored with GitHub Linguist colours.
- Scores (0-10) for activity, stack diversity, and project quality, combined into an overall score and a hireability band: Beginner, Developing, Junior Ready, Strong Junior, or Hireable.
- Repository highlights: top 5 repositories by stars with language, star count, and last update.
- Deterministic, rule-based insights and a short summary. No AI or LLM is involved.
- Optional accounts (GitHub OAuth or email magic link): save candidates with notes, review report history, publish reports on public share links with expiry, revocation, and view counts.
- Dark and light themes, responsive layout, visible keyboard focus.

Analysis reads public GitHub data only. Reports are persisted for signed-in users; anonymous analysis is not stored.

## Status and scope

StackLens is a complete, self-hostable tool, deliberately small. Out of scope by design: billing, team accounts, AI-generated summaries, ATS integrations, and bulk profile import. It runs entirely on free tiers (Vercel Hobby, Neon free, Upstash free, Resend free, Sentry free). The former standalone Render backend has been retired; the API is the Vercel project's serverless function.

## Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 3.4, react-router 7. Self-hosted variable fonts (Archivo, Martian Mono) via `@fontsource-variable`; design tokens in `frontend/src/index.css` and `frontend/tailwind.config.js`. |
| Backend | Node 20+, Express 5 (CommonJS), deployed as a single Vercel serverless function (`api/index.js`, `maxDuration 60`). |
| Data | PostgreSQL (Neon) via `pg`, no ORM. Migrations are plain SQL in `db/migrations/`, applied by `npm run migrate`. |
| Auth | Better Auth 1.7 with database sessions: GitHub OAuth + email magic link (Resend). Entirely env-gated; without config the app still boots and `/api/auth/*` returns `503 CONFIG_MISSING`. |
| Rate limiting | In-memory by default, Upstash Redis when configured: 10/min anonymous and 100/min authenticated on `/api/*`; 30/min on mutating auth endpoints only (session reads are never limited). |
| Errors | Sentry, env-gated (`SENTRY_DSN` server, `VITE_SENTRY_DSN` browser), errors only, no tracing. |

System design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Operations runbook: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project structure

```text
stacklens/
├── api/          # Express app and routers: index, candidates, history, share
├── lib/          # Engine and infrastructure: report, github, auth, db, errors,
│                 #   rateLimit, validation, session, reportStore
├── db/           # migrate.js + plain-SQL migrations
├── test/         # Vitest unit and integration suites with golden fixtures
├── e2e/          # Playwright specs: analyze, a11y (axe), signed-in, prod smoke
├── scripts/      # Dev tooling: capture-fixtures, generate-goldens
├── frontend/     # React 19 + TypeScript SPA (Vite, Tailwind, own lint config)
├── docs/         # ARCHITECTURE.md, DEPLOYMENT.md
├── vercel.json   # Function + rewrites: /api/*, /health, SPA fallback
└── package.json  # Root scripts and dependencies (Node >= 20)
```

## Local development

Prerequisites: Node 20+ and npm. Docker is optional, only needed for the DB-gated tests.

```bash
npm install
npm install --prefix frontend
```

Run two terminals:

```bash
npm run dev                      # terminal 1: API on http://localhost:4000
npm --prefix frontend run dev    # terminal 2: app on http://localhost:5173
```

The Vite dev server proxies `/api` to port 4000. With zero environment variables the app boots and analysis works; unconfigured account features return `503 CONFIG_MISSING`. Copy `.env.example` to `.env` to enable accounts.

Local sign-in notes:

- Magic links can be tested without a mail provider: set `MAGIC_LINK_CAPTURE_FILE` and the link is appended to that file and printed in the API terminal.
- GitHub OAuth needs `http://localhost:4000/api/auth/callback/github` registered as a callback URL on the OAuth app.

## Configuration

Nothing is required to boot. `.env.example` is the annotated reference; production guidance is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

| Variable | Needed for | Purpose |
| -------- | ---------- | ------- |
| `DATABASE_URL` | accounts | Postgres connection string (Neon pooled) |
| `BETTER_AUTH_SECRET` | accounts | Session signing key; required with `DATABASE_URL` |
| `BETTER_AUTH_URL` | accounts (prod) | Public base URL of the API |
| `TRUSTED_ORIGINS` | accounts (prod) | Extra origins allowed to call the auth API |
| `ALLOWED_ORIGINS` | production | CORS allowlist, comma-separated |
| `APP_ORIGIN` | optional | SPA origin to return to after failed sign-ins |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub sign-in | OAuth app credentials |
| `RESEND_API_KEY` / `EMAIL_FROM` | magic link | Email delivery via Resend |
| `GITHUB_TOKEN` | recommended | Raises GitHub API quota from 60 to 5,000 req/h |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | optional | Distributed rate limiting on serverless |
| `RATE_LIMIT_ANON` / `RATE_LIMIT_AUTH` / `RATE_LIMIT_AUTH_ROUTES` | optional | Requests per minute; defaults 10 / 100 / 30 |
| `SENTRY_DSN` | optional | Server error tracking |
| `VITE_SENTRY_DSN` | optional | Browser error tracking (frontend env, public value) |
| `TEST_DATABASE_URL` | tests only | DB-gated integration tests; never set in production |

## API

All JSON responses use one envelope: success `{ ok: true, data }`, failure `{ ok: false, error: { code, message, retryable, status } }`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| GET | `/health` | none | Liveness probe |
| GET | `/api/analyze?q=` | none | Analyze a profile (username or URL) |
| ALL | `/api/auth/*` | public | Better Auth endpoints (sign-in, session, callbacks) |
| GET, POST | `/api/candidates` | session | List or upsert saved candidates |
| DELETE | `/api/candidates/:id` | session | Delete a saved candidate |
| GET | `/api/history` | session | List stored reports (`limit`, `offset`) |
| GET | `/api/history/:id` | session | Fetch one stored report |
| POST | `/api/share` | session | Create a share link; raw token returned once |
| GET | `/api/share/:token` | none | Public shared report; bumps view count |
| DELETE | `/api/shares/:id` | session | Revoke a share link |

## Testing

```bash
npm test                # 124 pass, 20 DB-gated skipped (zero env)
npm run test:unit       # engine + validation
npm run test:integration
npm run test:watch
npm run test:e2e        # Playwright against the Vite dev server (mock GitHub)
npm run test:e2e:prod   # builds the bundle, serves it via vite preview on :4173,
                        # and asserts no blank page or page errors
npm run lint            # root eslint (frontend: npm --prefix frontend run lint)
```

The 20 skipped suites run against `TEST_DATABASE_URL`; a `postgres:16-alpine` Docker recipe is in `.env.example`. CI runs all 144 tests against a Postgres service container. Playwright covers dev-server E2E plus a production-build smoke test (added after a production-only crash once shipped), and axe-core checks accessibility.

## Deployment

Deploy as one Vercel project with Root Directory set to the repo root, not `frontend/`: the root `vercel.json` builds the SPA from `frontend/dist`, deploys `api/index.js` as the API function, and rewrites `/api/*` and `/health` to it with an SPA fallback. Set environment variables in the Vercel project, apply migrations with `npm run migrate`, then verify `/health` and `/api/analyze?q=octocat`.

CI (`.github/workflows/ci.yml`) lints, builds, and tests on every PR and push, and applies migrations on `main`. `backup.yml` takes a nightly `pg_dump` to Cloudflare R2 with 14-day retention. Service provisioning, secrets, backups, restore, and troubleshooting: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## License

ISC.
