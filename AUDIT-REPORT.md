# StackLens — Full Project Audit (2026-11-03)

Read-only audit: source analysis of `api/`, `lib/`, `db/`, `frontend/src/`, scripts, configs, CI;
`npm test` re-run; `npm audit` (root + frontend); `git ls-files` secret check; one live probe
against the production URL. Items marked *(suspected)* were not conclusively proven from code.
No files were modified by the audit.

---

## 1. Critical

| # | Where | Issue |
|---|-------|-------|
| C1 | `package.json:38`, `frontend/package.json:17` | **better-auth locked at 1.7.5 inside known-vulnerable range (≤1.7.6).** npm audit reports a critical chain via `@better-auth/drizzle-adapter` (GHSA-44jh-23m7-hpcf); public advisories GHSA-r4xp-prcq-77qf (OAuth Proxy → sign in as another user) and GHSA-965c-763c-88jm (OAuth state usable as magic link) cover this version line, and this app ships **both** GitHub OAuth and magic-link sign-in. Fixed upstream in 1.7.15. |
| C2 | `package-lock.json` (proxy-addr 2.0.7), `api/index.js:28` | **proxy-addr 2.0.7 critical: IP spoofing via IPv4-mapped IPv6 trust subnets (GHSA-jqcg-44mw-7w3h).** `app.set("trust proxy", 1)` routes `req.ip` through it; `req.ip` is the rate-limiter key → attackers can bypass their own quota or exhaust a victim's bucket. Fix available. |

## 2. High

| # | Where | Issue |
|---|-------|-------|
| H1 | `api/index.js:57-61,111-116` | **`req.user` is never assigned anywhere** (grep-verified). The session is resolved per-route *after* the limiter middleware runs, so the `authedLimiter` (100/min) is dead code — **every signed-in user is capped at the anonymous 10/min tier**, contradicting README. Recruiters hitting 11 analyses/minute get 429s. |
| H2 | `ci.yml:45,80,114` vs `package.json:18` | **Node drift: CI pins Node 20 (EOL), `engines: ">=20"` is open, Vercel runs its default (Node 24).** Production executes a runtime CI never tests — the exact prod-only failure class README says already bit once. |
| H3 | live prod URL (observed) | **Vercel Security Checkpoint 429s non-browser clients on `/health` and `/api/*`** (`X-Vercel-Mitigated: challenge`). docs/DEPLOYMENT.md:50 tells you to monitor `/health` with UptimeRobot → false "site down" alerts; server-side consumers of the API are blocked. Exempt `/health` + verified API clients in the Vercel Firewall. |
| H4 | `ci.yml:101-128` | **Migration job is fail-open and races the deploy:** missing `DATABASE_URL` → "skipping", `exit 0`, green build while prod schema silently never applied; `needs: quality` only, runs concurrently with Vercel auto-deploy — no ordering guarantee between migrate and new code going live. |
| H5 | `lib/github.js:79,95` | **No axios `timeout` on `fetchUser`/`fetchAllRepos`** (default = infinite). A stalled GitHub connection holds the function until Vercel's 60s kill; analyze does 1 + up to 10 sequential fetches. **Also: GitHub HTTP 429 (secondary/abuse limits) is not handled** — falls through to 502 `UPSTREAM_ERROR`, `Retry-After` discarded. |
| H6 | `package.json` + lockfile | **axios 1.18.0 — 12 high advisories** (redirect-SSRF, ReDoS, header injection, prototype pollution). The library is on the hot path parsing user-supplied profile names. 1.21.0 available. |
| H7 | `package.json:44` | **zod 4.6.5 high (GHSA-mrhx-c7xc-m3w5)** — memory exhaustion while validating oversized constrained collections; zod validates every untrusted query/body. Fixed in ≥4.6.6. |
| H8 | `ci.yml` (overall) | **No `npm audit` step anywhere in CI**, and install on deploy uses `npm install` while CI uses `npm ci` (vercel.json:3) — lockfile drift can ship untested versions; today's 30+ advisories ship green. |

## 3. Medium

| # | Where | Issue |
|---|-------|-------|
| M1 | `lib/rateLimit.js:6-39` | In-memory limiter is per-λ-instance (limit × warm instances) and **fails open on any error incl. Upstash free-tier quota** (`rateLimit.js:86-89`) — silently degrades exactly when traffic grows. Doc-disclosed but unmonitored; no limiter error reporting to Sentry. |
| M2 | `api/index.js:32`, `lib/auth.js:87` | `http://localhost:5173` **hard-coded into production CORS + Better Auth `trustedOrigins`** always. Any page that ends up served from that origin can make authenticated calls. Should be dev-only. |
| M3 | `vercel.json` | **No `headers` block** — helmet covers only `/api/*` responses; the static SPA ships with no CSP, no frame-ancestors, no nosniff, no referrer-policy. Clickjacking/XSS blast radius on 100% of the UI half. |
| M4 | `lib/auth.js:108` | `baseURL` falls back to `http://localhost:4000` when `BETTER_AUTH_URL` is unset in prod — OAuth callbacks / magic-link URLs then point at localhost *(suspected severity: depends on Better Auth version's URL inference)*. `isAuthConfigured()` (line 14-16) checks only `DATABASE_URL` + `SECRET`, so prod can boot "configured" with a broken base URL. |
| M5 | `lib/validation.js:4-23` | **URL/username extraction is inconsistent:** scheme-full URLs take the owner segment, scheme-less paths take the **last** segment — `?q=torvalds/linux` analyzes repo `linux` as a username. Extracted values are never re-validated against the username schema. |
| M6 | `lib/github.js:92-103` | `MAX_PAGES = 10` **silently truncates profiles with >1000 repos** (no `meta` flag), and `sort=updated` pagination can page-shift (duplicate/skip repos) on busy profiles. |
| M7 | `db/migrate.js:35-58` | **No advisory lock** — two concurrent migration runs race on `schema_migrations` UNIQUE; one fails spewingly. `CREATE TABLE IF NOT EXISTS` (001_init.sql) also makes hand-drifted schemas invisible until a later constraint errors at write time. |
| M8 | `test/integration/auth.test.js:105`, `features.test.js:172` | **DB-gated suites skip silently and nothing asserts "0 skipped"** — a typo'd `TEST_DATABASE_URL` or a dropped service yields green CI on a shrinking test surface (asymmetric false confidence). |
| M9 | `e2e/signedin.spec.ts:17` + `ci.yml:69-99` | The signed-in e2e job sets **no `E2E_DATABASE_URL`/Postgres service** → the only browser coverage of share/history/candidates/session flows **never runs in CI**. |
| M10 | `scripts/generate-goldens.mjs:33-35`, `scripts/capture-fixtures.mjs:11-21` | **Golden regeneration rewrites goldens from the same code the test compares against** — one command converts any regression into green. `capture-fixtures` loads the *entire* root `.env` (incl. production DB creds) into `process.env` and overwrites fixtures with no diff mode. |
| M11 | `backup.yml:26-34,40-44,75` | Backup exits green when secrets are missing (and skips the 14-day prune in that path); `pg_dump` unpinned from the runner image vs Neon's server major; alerting is only GitHub's default email. Backups can silently stop for weeks. |
| M12 | Playwright configs | `retries: 0`, `reporter: list`, no trace/screenshot retention, no artifact upload in CI — flakes are undiagnosable. |
| M13 | `AnalyzePage.tsx` SignInDialog etc. | **Sign-in dialog has no focus trap and never returns focus on close** (`SignInDialog.tsx:16-31`, `aria-modal="true"` unenforced) — Tab escapes behind the scrim. |
| M14 | `index.css:576-594` + `ui.tsx:197-203` | **`prefers-reduced-motion` only cancels the named animations — Tailwind `animate-pulse` in SkeletonPulse keeps running**, violating the DESIGN.md promise of full suppression. |
| M15 | `useTheme.ts:15-24` | Theme effect **writes `localStorage` on first visit unconditionally** → after one visit the OS preference is frozen forever; and there is no `matchMedia` change listener (OS theme changes mid-session ignored). |
| M16 | `AnalyzePage.tsx:204-252` | No abort/supersede guard in `runAnalysis`; `ranInitialQuery` ref ignores a later `?q=` change on the mounted route; successful analysis never writes `?q=` back to the URL (refresh loses the reading); no scroll restoration anywhere (App.tsx). |

## 4. Low / Info

| # | Where | Issue |
|---|-------|-------|
| L1 | `api/index.js:52-54` | `/health` returns `{ok:true}` — violates the documented `{ok:true,data}` envelope (README:100). |
| L2 | `api/index.js:52` | `/health` also carries no version/uptime info and is served pre-limiter (fine) — but the SPA fallback regex `((?!api/|health).*)` makes bare `GET /api` return `index.html` 200 and `/health/` 404. |
| L3 | `lib/report.json` engine paths, `lib/report.js:196-199` | Future/invalid `created_at` yields negative/`null` account ages (`-0.3` years); ties in language/top-repo sorts fall back to upstream order. |
| L4 | `lib/report.js:1`, `lib/reportStore.js:7-12` | Report hash includes wall-clock fields → same unchanged profile hashes differently hours later → **history accumulates near-duplicate rows** for heavy users. |
| L5 | `api/index.js:64-75` | `RATE_LIMIT_ANON=-5` → max=-5 → **every request 429s forever**; `=0` silently becomes 10; `=abc` silently falls back (no parse warning). |
| L6 | `lib/db.js:22-42` | pg pool: no `on("error")` listener (idle-client errors propagate as uncaught events), no `connectionTimeoutMillis`, and `ssl: { rejectUnauthorized: false }` disables cert validation for all non-localhost URLs; `backend.err.log` shows the upcoming pg SSL-mode semantics change already warning. |
| L7 | `server.js:4-7` | Only `.env` is loaded — `.env.local` (which `.gitignore` advertises) is never merged. |
| L8 | `.gitignore` | `.env*` swallows `.env.example` (no `!.env.example` negation — works today only because they're already tracked); `.impeccable/` not ignored → `git add .` commits design-review artifacts. |
| L9 | `.github/workflows` | Actions pinned by mutable tags, not SHAs; workflows with `DATABASE_URL`/R2 credentials execute under them. |
| L10 | `lib/session.js:44-47` | `getSessionUser` swallows auth/DB errors and returns null → transient DB outage renders as 401 "Sign in required" (misleading). |
| L11 | `lib/auth.js:52-60` | If `MAGIC_LINK_CAPTURE_FILE` is ever set in prod, token + recipient email are appended to a plaintext file and printed to console — dev footgun guarded only by convention. |
| L12 | `AnalyzePage.tsx:81-85` | Share success message says "Link copied" even when the clipboard write fails. |
| L13 | `HistoryPage.tsx:115-132` | `openReport` has no request-order guard — rapid row-clicks can let a slow earlier fetch overwrite a newer selection. |
| L14 | `history row click pattern duplicate-load loops` — `SavedPage.tsx:83-106,110-143` | `load()` and the `useEffect` fetch duplicate the same logic/state machine (upholdable drift risk), and page-gate messages: on an **unconfigured** server the page claims "Sign in to save candidates" while sign-in can never succeed (CONFIG_MISSING message unreachable). Same shape in HistoryPage. |
| L15 | `frontend/package.json:16,34` | `@tailwindcss/postcss` v4 in `dependencies` while the project builds through Tailwind v3 plugin — dead dep from a false "upgrade" invite; move/remove. |
| L16 | `frontend/src/App.css` | Unreferenced (grep-verified) — dead file; `tailwind.config.js` legacy aliases (`paper`, `panel`, `primary.*`, `surface.*`) also dead. |
| L17 | Global | Static `<title>` forever — no `document.title` anywhere in `frontend/src` (grep-verified); no per-route metadata. |
| L18 | `e2e/helpers.ts:103-117`, `e2e/zz-ratelimit.spec.ts` | Whole e2e suite shares one 10/min bucket with 65s sleeps and depends on alphabetical filename ordering; any new spec or parallelization breaks it. |
| L19 | `vercel.json` | `installCommand` runs `npm install` (not `npm ci`) — deploys don't enforce the lockfile CI and tests run under. |
| L20 | Repo state | The **entire redesign is uncommitted** (17 modified files) plus untracked `DESIGN.md`/`PRODUCT.md`/`.impeccable/`; DESIGN.md/PRODUCT.md — the new source-of-truth docs — exist only on this machine. |
| L21 | Ops | Vercel CLI locally is outdated (65.5.0 → 65.9.0); `regions` unpinned relative to the Neon region (latency/cold-start only); restore procedure exists but has never been drilled. |
| L22 | `docs/DEPLOYMENT.md:61,70` | `ALLOWED_ORIGINS` marked "prod: yes" although same-origin deployment never triggers CORS; the actually-important `TRUSTED_ORIGINS`/`BETTER_AUTH_URL` are easy to under-prioritize. |

## 5. Verified clean (positives)

- **IDOR: none.** Every row-level SQL statement filters by session `user_id` (candidates GET/POST/DELETE, history both routes, share create/delete). Types are parameterized everywhere — no string-built SQL.
- **Share tokens are strong:** `crypto.randomBytes(32)` base64url, only `sha256(token)` stored, raw returned once, unknown/expired indistinguishable (404), expiry enforced in the UPDATE, view-count bump atomic in the same CTE.
- **No XSS injection surface:** no `dangerouslySetInnerHTML`/`innerHTML` anywhere in the frontend (grep-verified); React text-escapes all GitHub-derived fields.
- **Envelope/error handling:** error handler never leaks stacks or internals; 4xx not sent to Sentry; test-only session override properly gated on `NODE_ENV === "test"`.
- **No secrets in git:** `git ls-files` shows `.env*`, all `*.log`, `test-results/`, `.vercel` untracked; `.env.example` contains placeholders.
- **`npm test` re-run during this audit: 124 passed, 20 (DB-gated) skipped, 0 fail** on the redesigned working tree.
- README test-count math verified; backup never echoes the connection string; `capture-fixtures` does not touch the DB.

## 6. Priority order

1. Bump **better-auth → 1.7.15+** in both trees + `npm audit fix` (closes C1, C2, H6, H7 at once) and add `npm audit --audit-level=high` to CI (H8).
2. Assign `req.user` before the `/api` limiter so the authed tier works (H1).
3. Pin Node to one tested version across CI/engines/Vercel (H2); exempt `/health` from the Vercel challenge (H3).
4. Add axios timeouts + GitHub 429 handling (H5).
5. Fail-closed migration job + deploy-order guarantee (H4); assert 0 skipped tests in CI (M8/M9).
