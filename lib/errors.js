const ERROR_CODES = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INTERNAL: "INTERNAL",
  CONFIG_MISSING: "CONFIG_MISSING",
};

class ApiError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = options.status ?? 500;
    this.retryable = options.retryable ?? false;
    if (options.details !== undefined) this.details = options.details;
    if (options.retryAfter !== undefined) this.retryAfter = options.retryAfter;
  }
}

function configMissing() {
  return new ApiError(
    ERROR_CODES.CONFIG_MISSING,
    "Feature not configured on this server.",
    { status: 503, retryable: false }
  );
}

function toErrorEnvelope(err) {
  const error = {
    code: err.code,
    message: err.message,
    retryable: err.retryable,
    status: err.status,
  };
  if (err.code === ERROR_CODES.VALIDATION && Array.isArray(err.details)) {
    error.details = err.details;
  }
  return { ok: false, error };
}

// Reports an error to Sentry when SENTRY_DSN is configured (the SDK is
// initialized in api/index.js under the same gate). Loaded lazily so the
// dependency cost is zero when error tracking is off, and telemetry
// failures must never break error handling.
function reportToSentry(err) {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = require("@sentry/node");
    Sentry.captureException(err);
  } catch {
    // Swallow telemetry failures — the HTTP response matters more.
  }
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    // 5xx-class server/upstream errors are reported; 4xx client errors
    // (validation, auth, rate limits) are expected traffic, not defects.
    if (err.status >= 500) reportToSentry(err);
    if (err.retryAfter !== undefined) {
      res.set("Retry-After", String(Math.max(0, Math.ceil(err.retryAfter))));
    }
    return res.status(err.status).json(toErrorEnvelope(err));
  }

  if (err && err.type === "entity.parse.failed") {
    const wrapped = new ApiError(ERROR_CODES.VALIDATION, "Invalid JSON body.", {
      status: 400,
    });
    return res.status(wrapped.status).json(toErrorEnvelope(wrapped));
  }

  reportToSentry(err);
  console.error(`Unhandled error: ${err?.message || err}`);
  const internal = new ApiError(
    ERROR_CODES.INTERNAL,
    "Internal server error. Please try again later.",
    { status: 500, retryable: true }
  );
  return res.status(internal.status).json(toErrorEnvelope(internal));
}

module.exports = { ApiError, ERROR_CODES, configMissing, errorHandler };
