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
const candidatesRouter = require("./candidates");
const historyRouter = require("./history");
const shareRouter = require("./share");

// Optional error tracking: enabled only when SENTRY_DSN is configured, and
// the SDK is not even loaded otherwise, so zero-env boots are unaffected.
// Errors only — no tracing (tracesSampleRate 0).
if (process.env.SENTRY_DSN) {
  const Sentry = require("@sentry/node");
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
}

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

app.use(helmet());

const allowedOrigins = new Set(["http://localhost:5173"]);
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
const rateKeyFn = (req) => {
  const userId = req.user?.id;
  if (userId !== undefined && userId !== null) return `user:${userId}`;
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
};
const anonLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_ANON) || 10,
  keyFn: rateKeyFn,
});
const authedLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_AUTH) || 100,
  keyFn: rateKeyFn,
});
const authRouteLimiter = createRateLimiter({
  windowMs: WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_AUTH_ROUTES) || 5,
  keyFn: rateKeyFn,
});

// Better Auth catch-all. Mounted BEFORE express.json() so the auth handler
// receives the raw request body, and with a stricter per-IP limit.
// When auth is not configured, /api/auth/* degrades to 503 CONFIG_MISSING.
app.all("/api/auth/{*any}", authRouteLimiter, async (req, res, next) => {
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

app.use("/api", (req, res, next) => {
  const userId = req.user?.id;
  const limiter =
    userId !== undefined && userId !== null ? authedLimiter : anonLimiter;
  return limiter(req, res, next);
});

// Signed-in feature routers (candidates / history / share links). Mounted
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
    // Never let history/storage problems break analysis itself.
    let reportId = null;
    try {
      if (isDbConfigured()) {
        const session = await getSessionUser(req);
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
