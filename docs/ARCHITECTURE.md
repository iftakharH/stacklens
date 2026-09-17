# StackLens — MVP Architecture

_Current as of the MVP freeze. Verify claims against the code before changing
them; this document is a map, not a contract._

## 1. Product & system summary

StackLens reads a public GitHub profile and returns a single, deterministic
developer report: overview (avatar, bio, followers, repos, account age, last
activity), stack (primary/secondary language + weighted distribution),
repository highlights, three 0–10 scores (activity, stack diversity, project
quality) with an overall score and a plain-language hireability band, and
short rule-based insights. Anonymous analysis is the core product and needs no
account. Optional accounts (Better Auth: GitHub OAuth + email magic link) add
saved candidates, report history, and public share links.

The whole product ships as **one Vercel project**: a static React 19 SPA plus a
single Express 5 serverless function (`api/index.js`). The repo-root
`vercel.json` wires the routing so `/api/*` and `/health` hit the function and
everything else falls back to `index.html`.

```
 Browser
   │  GET /            → static frontend/dist (SPA, client-side routes)
   │  GET /api/*       → vercel.json rewrite ───┐
   │  GET /health      → vercel.json rewrite ───┤
   ▼                                            ▼
 Vercel static hosting                    api/index.js  (Express 5, Node 20)
                                            ├─ helmet, CORS allowlist
                                            ├─ rate limiters (in-memory | Upstash)
                                            ├─ /api/auth/*  → lib/auth.js (Better Auth)
                                            ├─ /api/analyze → lib/github.js → GitHub REST
                                            │                 lib/report.js (pure engine)
                                            ├─ /api/candidates, /api/history, /api/share
                                            └─ lib/db.js → Neon Postgres (pooled)
                                                  │
                          ┌──────────────┬────────┴───────┬──────────────┐
                          ▼              ▼                ▼              ▼
                    Neon Postgres   GitHub REST       Resend        Upstash Redis
                    (accounts,      (axios, public    (magic-link   (distributed
                    reports,        data)             email)        rate limits)
                    share links)
                    Sentry (env-gated): SENTRY_DSN server errors, VITE_SENTRY_DSN browser errors
```

## 2. Runtime topology & the $0 constraint

Everything runs on free tiers. Behaviour at each limit:

| Service | Free-tier limit | What happens at the limit |
| ------- | --------------- | ------------------------- |
| Vercel Hobby | static bandwidth + function invocations; function maxDuration 60s (`vercel.json`) | Throttled/blocked requests; the static SPA may still serve, API calls fail. |
| Neon Postgres | ~0.5 GB storage, compute auto-suspends | Cold first query (slow); auth/features error out — analysis still works because it is DB-independent. |
| GitHub REST | 60 req/h per IP anonymous, 5,000/h with `GITHUB_TOKEN` | `lib/github.js` maps `403` + `x-ratelimit-remaining: 0` → HTTP 429 `RATE_LIMITED` with a retry countdown. |
| Resend | ~100 emails/day | Magic-link send fails; GitHub OAuth still works. |
| Upstash Redis (optional) | free command quota | Limiter falls back to allow-on-error (`lib/rateLimit.js` logs and calls `next()`). |
| Sentry (optional) | free events quota | SDK is env-gated; without a DSN it never loads. |

The API boots with **zero environment variables**: `/health` and
`/api/analyze` work, and account/feature routes degrade to `503
CONFIG_MISSING` rather than crashing.

## 3. Data model (`db/migrations/001_init.sql`)

Better Auth core tables (camelCase columns, per the Better Auth schema):

| Table | Purpose |
| ----- | ------- |
| `user` | Account identity: `id`, `name`, `email` (unique), `emailVerified`, `image`, timestamps. |
| `session` | DB-backed sessions: `token` (unique), `expiresAt`, `userId` FK, IP/user-agent. |
| `account` | Linked providers (GitHub/email): `providerId`, `accountId`, OAuth tokens, `scope`, `password`. |
| `verification` | Short-lived values for magic-link tokens and OAuth state. |

StackLens app tables:

| Table | Purpose |
| ----- | ------- |
| `candidates` | Saved shortlist: `user_id` FK, `github_username`, `note`. Unique `(user_id, github_username)` so re-saving updates the note. |
| `reports` | Persisted report: `github_username`, `report` JSONB, `engine_version` (default `1.0.0`), `sha256_hash`, nullable `user_id` FK. Unique `(user_id, sha256_hash)` so identical content dedupes per user. |
| `share_links` | Public links: `report_id` FK, `token_hash` (unique; only the sha256 of the raw token is stored), `expires_at`, `view_count`. |
| `schema_migrations` | Applied-migration ledger for `db/migrate.js`. |

Indexes: `reports(user_id, created_at desc)`, `reports(github_username,
created_at desc)`, `share_links(report_id)`, `session(userId)`,
`account(userId)`, `candidates(user_id)`.

## 4. Auth flow (Better Auth + DB sessions)

- **Lazy, env-gated.** `lib/auth.js` dynamic-imports Better Auth (ESM) inside an
  async initializer and only when `DATABASE_URL` **and** `BETTER_AUTH_SECRET`
  are set. `getAuth()` returns `null` otherwise; `api/index.js` then answers
  `/api/auth/*` with `503 CONFIG_MISSING`.
- **Providers.** GitHub OAuth (when `GITHUB_CLIENT_ID`/`SECRET` set) and email
  magic link (when `magicLinkEmailEnabled()` — a Resend key + `EMAIL_FROM`, a
  test capture hook, or `MAGIC_LINK_CAPTURE_FILE`).
- **baseURL** = `BETTER_AUTH_URL` (dev `http://localhost:4000`, prod the
  canonical alias). **trustedOrigins** = `http://localhost:5173` always, plus
  `TRUSTED_ORIGINS`; the baseURL origin is implicitly trusted.
- **Client base URL must be absolute.** `frontend/src/api/auth.ts` resolves
  `VITE_AUTH_BASE_URL` → dev `http://localhost:4000/api/auth` → otherwise
  `${window.location.origin}/api/auth`. A relative value makes Better Auth throw
  during module evaluation (blank page), so the client is also wrapped in a
  try/catch fallback.
- **Callback URLs** passed to `signIn.social` / `signIn.magicLink` are absolute
  and same-origin (`${window.location.origin}/analyze`). In dev the SPA is on
  `:5173` and the API on `:4000`; a relative callback would resolve against the
  API origin (wrong host). Better Auth validates the origin against
  `trustedOrigins`.
- **Cookies** are host-scoped. Dev talks straight to `:4000` (localhost cookies
  are shared across ports). Prod is same-origin, so the session cookie rides
  `/api/auth`.
- **CORS** (`api/index.js`): allowlist `http://localhost:5173` +
  `ALLOWED_ORIGINS`, `credentials: true`.
- **Test override.** When `NODE_ENV === "test"` and `TEST_SESSION_USER_ID` is
  set, `lib/session.js` treats every request as that user. Never active in
  production.

## 5. API surface

All responses use the envelope `{ ok: true, data }` or
`{ ok: false, error: { code, message, retryable, status, details? } }`.

| Method | Path | Auth | Notes |
| ------ | ---- | ---- | ----- |
| GET | `/health` | public | `{ ok: true }`, no dependencies. |
| GET | `/api/analyze?q=` | public | GitHub fetch + `computeReport`. Persists for signed-in users when DB is available (`report_id`). |
| ALL | `/api/auth/*` | public | Better Auth catch-all; stricter rate limit. `503` when unconfigured. |
| GET | `/api/candidates` | signed-in | User's shortlist, newest first. |
| POST | `/api/candidates` | signed-in | Upsert `{ github_username, note? }`. |
| DELETE | `/api/candidates/:id` | signed-in | Owner-only. |
| GET | `/api/history?limit&offset` | signed-in | Persisted reports; overall/hireability read from JSONB. |
| GET | `/api/history/:id` | signed-in | Owner-only stored report. |
| POST | `/api/share` | signed-in | Creates a link for one of the user's reports; raw token returned once. |
| GET | `/api/share/:token` | public | DB required. Unknown/expired tokens are indistinguishable `404`. Bumps `view_count`. |
| DELETE | `/api/shares/:id` | signed-in | Link creator or report owner. |
| * | anything else | — | `404 NOT_FOUND`. |

## 6. Rate limiting & caching

- `lib/rateLimit.js` builds a sliding-window limiter per key (`user:<id>` when
  authenticated, else `ip:<addr>`). Storage is **Upstash Redis** when both
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, otherwise a
  per-process in-memory map. A limiter failure logs and allows the request.
- Defaults (`RATE_LIMIT_*`): anonymous `/api/*` 10/min, authenticated 100/min,
  `/api/auth/*` 5/min. Responses carry `X-RateLimit-Limit/Remaining/Reset`;
  a breach returns `429 RATE_LIMITED` + `Retry-After`.
- No API response caching: every analysis refetches GitHub (so the GitHub quota
  is the real ceiling). Persistence dedupes identical reports by content
  hash but does not serve them back for `/api/analyze`.
- Static assets are content-hashed and immutable; the SPA HTML is not cached by
  app code.

## 7. Environment matrix

`.env` (repo root) holds **local** values; the Vercel project holds
**production** values. Never copy a production URL into the local file.

| Variable | Local | Production | Required? |
| -------- | ----- | ---------- | --------- |
| `PORT` | `4000` | set by Vercel | no |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | `https://stacklens-purple.vercel.app` | prod: yes |
| `GITHUB_TOKEN` | unset/empty | PAT | recommended (60→5,000 req/h) |
| `RATE_LIMIT_ANON` / `_AUTH` / `_AUTH_ROUTES` | `10` / `100` / `5` | same | no |
| `DATABASE_URL` | Neon pooled string | Neon pooled string | for accounts |
| `BETTER_AUTH_SECRET` | local secret | prod secret | with `DATABASE_URL` |
| `BETTER_AUTH_URL` | `http://localhost:4000` | `https://stacklens-purple.vercel.app` | prod: yes |
| `TRUSTED_ORIGINS` | `http://localhost:5173,http://localhost:4000` | `https://stacklens-purple.vercel.app` | prod: yes |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth app | same app | for GitHub sign-in |
| `RESEND_API_KEY` / `EMAIL_FROM` | Resend key | Resend key | for magic link |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | unset | recommended | no |
| `SENTRY_DSN` | unset | DSN | no |
| `VITE_SENTRY_DSN` | unset (frontend env) | DSN | no (public) |
| `VITE_AUTH_BASE_URL` | unset | unset | no (absolute override) |
| `GITHUB_API_BASE`, `TEST_DATABASE_URL`, `E2E_DATABASE_URL`, `MAGIC_LINK_CAPTURE_FILE`, `TEST_SESSION_USER_ID`, `NODE_ENV=test` | tests only | **never** | no |

Local GitHub OAuth needs `http://localhost:4000/api/auth/callback/github` in
the OAuth app; production needs
`https://stacklens-purple.vercel.app/api/auth/callback/github`.

## 8. Invariants

1. **Engine byte-stability.** `lib/report.js` (`computeReport`, and
   `extractUsernameFromUrl` in `lib/validation.js`) is frozen. Golden fixtures
   in `test/fixtures/golden/*` assert byte-identical output.
2. **Envelope shape.** Every API response is `{ ok: true, data }` or
   `{ ok: false, error }`; error `code`/`status` mapping is stable and asserted
   by the integration suite.
3. **Zero-env graceful degradation.** The app boots and analyzes with no
   environment at all; gated features return `503 CONFIG_MISSING`.
4. **Local ≠ production config.** Origins/URLs differ per environment and are
   never mixed.
5. **No blank pages.** Render errors are caught by `ErrorBoundary`; module-eval
   failures (auth base URL) are handled at the source.

## 9. Testing strategy

| Layer | Where | What it proves |
| ----- | ----- | -------------- |
| Unit | `test/unit/engine.test.js`, `validation.test.js` | Engine goldens + input parsing. |
| Integration | `test/integration/api.test.js`, `auth.test.js`, `features.test.js` (supertest, DB-gated) | Envelope, error codes, auth/feature contracts. |
| Dev E2E | `e2e/*.spec.ts` via `playwright.config.ts` | Real browser against Vite dev (`:5173`) + mock GitHub (`:4999`) + API (`:4000`, `NODE_ENV=test`): analyze/share/rate-limit/a11y. |
| Prod-smoke E2E | `e2e/prod-smoke.spec.ts` via `playwright.prod.config.ts` | The **built** bundle served by `vite preview` (`:4173`) with the same-origin `/api` proxy; asserts `pageErrors` is empty so build-only crashes (the blank page) cannot ship again. |
| CI | `.github/workflows/ci.yml` | `quality`: lint (root + frontend), `tsc -b`, `vite build`, `npm test` against Postgres 16 (144 tests). `e2e`: Playwright browser install, `npm run test:e2e`, `npm run test:e2e:prod`. `migrate`: `node db/migrate.js` on pushes to `main`. |

The dev suite runs zero-env by default; set `E2E_DATABASE_URL` (and
`npm run migrate`) to also run the DB-gated `signedin.spec.ts`.

## 10. Known constraints & follow-ups

- **No shared API cache** — GitHub's quota is the ceiling; Upstash only limits
  inbound requests.
- **In-memory rate limits are per instance** unless Upstash is configured, so
  serverless replicas each keep their own window.
- **Magic-link deliverability**: `onboarding@resend.dev` only sends to the
  Resend account owner; verify a domain for real inboxes.
- **Prod-smoke runs zero-env** (no DB): it proves render/bootstrap correctness,
  not live sign-in. Real-session UI is still only verified against production
  OAuth.
- **`engine_version`** is fixed at `1.0.0`; changing `lib/report.js` requires
  regenerating goldens and bumping it deliberately.
- **Legacy Render service** (`stacklens-s6or.onrender.com`) is obsolete — the
  API is the same Vercel project's `api/index.js` function. Nothing in the repo
  references it; it can be deleted in the Render dashboard.
