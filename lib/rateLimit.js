const { ApiError, ERROR_CODES } = require("./errors");

const UPSTASH_URL = () => process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || "";

function createInMemoryLimiter({ windowMs, max }) {
  const hits = new Map();
  let calls = 0;

  function sweep(now) {
    for (const [key, stamps] of hits) {
      const last = stamps[stamps.length - 1];
      if (last === undefined || last <= now - windowMs) hits.delete(key);
    }
  }

  return async function limit(key) {
    const now = Date.now();
    calls += 1;
    if (calls % 128 === 0) sweep(now);

    const stamps = hits.get(key) || [];
    while (stamps.length > 0 && stamps[0] <= now - windowMs) stamps.shift();

    if (stamps.length >= max) {
      const reset = stamps[0] + windowMs;
      return { success: false, limit: max, remaining: 0, reset };
    }

    stamps.push(now);
    hits.set(key, stamps);
    return {
      success: true,
      limit: max,
      remaining: Math.max(0, max - stamps.length),
      reset: stamps[0] + windowMs,
    };
  };
}

function createUpstashLimiter({ windowMs, max }) {
  const { Ratelimit } = require("@upstash/ratelimit");
  const { Redis } = require("@upstash/redis");

  const redis = new Redis({
    url: UPSTASH_URL(),
    token: UPSTASH_TOKEN(),
  });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      max,
      `${Math.max(1, Math.round(windowMs / 1000))} s`
    ),
    prefix: "stacklens/ratelimit",
  });

  return async function limit(key) {
    const result = await ratelimit.limit(key);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  };
}

const defaultKeyFn = (req) => {
  const userId = req.user?.id;
  if (userId !== undefined && userId !== null) return `user:${userId}`;
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
};

function createRateLimiter({ windowMs = 60_000, max = 10, keyFn = defaultKeyFn }) {
  const useUpstash = Boolean(UPSTASH_URL() && UPSTASH_TOKEN());
  const limit = useUpstash
    ? createUpstashLimiter({ windowMs, max })
    : createInMemoryLimiter({ windowMs, max });

  return async function rateLimitMiddleware(req, res, next) {
    const key = keyFn(req);
    let result;
    try {
      result = await limit(key);
    } catch (err) {
      console.error(`Rate limiter error (allowing request): ${err?.message || err}`);
      return next();
    }

    const resetSeconds = Math.max(
      0,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    res.set("X-RateLimit-Limit", String(result.limit));
    res.set("X-RateLimit-Remaining", String(result.remaining));
    res.set("X-RateLimit-Reset", String(resetSeconds));

    if (!result.success) {
      return next(
        new ApiError(
          ERROR_CODES.RATE_LIMITED,
          `Too many requests. Try again in ${resetSeconds} seconds.`,
          { status: 429, retryable: true, retryAfter: resetSeconds }
        )
      );
    }
    return next();
  };
}

module.exports = { createRateLimiter };
