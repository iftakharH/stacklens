const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { ApiError, ERROR_CODES, configMissing, errorHandler } = require("../lib/errors");
const { createRateLimiter } = require("../lib/rateLimit");
const { getAuthHandler } = require("../lib/auth");
const { isDbConfigured } = require("../lib/db");
const { getSessionUser } = require("../lib/session");
const { persistReport } = require("../lib/reportStore");
const { parseAnalyzeQuery } = require("../lib/validation");
const { fetchUser, fetchAllRepos } = require("../lib/github");
const { computeReport } = require("../lib/report");
const candidatesRouter = require("../lib/routes-candidates");
const historyRouter = require("../lib/routes-history");
const shareRouter = require("../lib/routes-share");

// Optional error tracking: enabled only when SENTRY_DSN is configured, and
// the SDK is not even loaded otherwise, so zero-env boots are unaffected.
// Errors only — no tracing (tracesSampleRate 0).
if (typeof process.env.SENTRY_DSN === "string" && process.env.SENTRY_DSN) {
  try {
    const Sentry = require("@sentry/node");
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
  } catch (err) {
    // A bad DSN must never take the whole API down at boot.
    console.error(`Sentry init skipped: ${err?.message || err}`);
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

app.use(helmet());

// Localhost is a dev/test convenience only — production allowlists must be
// built explicitly via ALLOWED_ORIGINS.
const allowedOrigins = new Set(
  process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"]
);
for (const origin of (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)) {
  allowedOrigins.add(origin);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const WINDOW_MS = 60_000;
// `RATE_LIMIT_* = "abc"` / "0" / "-5" previously produced either a silent
// fallback or an impossible negative max that 429'd every request forever.
// Clamp: anything that is not a positive finite integer falls back.
const positiveIntEnv = (name, fallback) => {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw < 1) return fallback;
  return Math.floor(raw);
};
const rateKeyFn = (req) => {
  const userId = req.user?.id;
  if (userId !== undefined && userId !== null) return `user:${userId}`;
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
};
const anonLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: positiveIntEnv("RATE_LIMIT_ANON", 10),
  keyFn: rateKeyFn,
});
const authedLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: positiveIntEnv("RATE_LIMIT_AUTH", 100),
  keyFn: rateKeyFn,
});
const authRouteLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: positiveIntEnv("RATE_LIMIT_AUTH_ROUTES", 30),
  keyFn: rateKeyFn,
});

// Session reads (GET/HEAD) happen on every page load and are cheap; limiting
// them locked visitors out of their own session and left the client's session
// promise pending (the UI looked frozen). Only the mutating auth endpoints —
// sign-in, callback, magic-link send, sign-out — are throttled.
const limitMutatingAuthOnly = (req, res, next) => {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return next();
  }
  return authRouteLimiter(req, res, next);
};

// Better Auth catch-all. Mounted BEFORE express.json() so the auth handler
// receives the raw request body. When auth is not configured, /api/auth/*
// degrades to 503 CONFIG_MISSING.
app.all("/api/auth/{*any}", limitMutatingAuthOnly, async (req, res, next) => {
  try {
    const handler = await getAuthHandler();
    if (!handler) {
      return next(configMissing());
    }
    await handler(req, res);
    return;
  } catch (err) {
    return next(err);
  }
});

app.use(express.json());

// Resolve the Better Auth session once for every /api request BEFORE the
// limiter, so the authed tier (RATE_LIMIT_AUTH, default 100/min) actually
// keys by user instead of every signed-in visitor sharing the anonymous
// 10/min bucket. Fails open: resolution errors never block the request, and
// route handlers that need a session re-resolve (or read req.user) later.
const resolveApiSession = (req, res, next) => {
  getSessionUser(req)
    .then((session) => {
      if (session?.user) {
        req.user = session.user;
        req.authSession = session.session;
      }
    })
    .catch(() => undefined)
    .finally(() => next());
};

app.use("/api", resolveApiSession);
app.use("/api", (req, res, next) => {
  const userId = req.user?.id;
  const limiter =
    userId !== undefined && userId !== null ? authedLimiter : anonLimiter;
  return limiter(req, res, next);
});// Signed-in feature routers (candidates / history / share links). Mounted
// after the auth catch-all and the /api rate limiter; each route resolves its
// own session and degrades to 401/503 when unauthenticated/unconfigured.
app.use("/api", candidatesRouter);
app.use("/api", historyRouter);
app.use("/api", shareRouter);

app.get("/api/analyze", async (req, res, next) => {
  try {
    const { username } = parseAnalyzeQuery(req.query);

    const user = await fetchUser(username);
    const repos = await fetchAllRepos(username);

    const report = computeReport(user, repos);

    // Persist the report for signed-in users when the DB is available.
    // Never let history/storage problems break analysis itself. Reuse the
    // session resolved by resolveApiSession when present.
    let reportId = null;
    try {
      if (isDbConfigured()) {
        const session = req.user ? { user: req.user } : await getSessionUser(req);
        if (session?.user?.id) {
          reportId = await persistReport({
            userId: session.user.id,
            githubUsername: username,
            report,
          });
        }
      }
    } catch (err) {
      console.error(`Report persistence skipped: ${err?.message || err}`);
    }

    res.json({
      ok: true,
      data: { username, report, report_id: reportId },
    });
  } catch (err) {
    next(err);
  }
});

app.use((_req, _res, next) => {
  next(
    new ApiError(ERROR_CODES.NOT_FOUND, "Route not found.", { status: 404 })
  );
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StackLens backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
