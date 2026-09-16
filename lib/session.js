const { getAuth, isAuthConfigured } = require("./auth");
const { isDbConfigured } = require("./db");
const { ApiError, ERROR_CODES, configMissing } = require("./errors");

function toHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") headers.append(key, item);
      }
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

// Returns { user, session } for the request's session cookie,
// or null when signed out / auth unconfigured.
//
// Test-only override: when NODE_ENV==="test" and TEST_SESSION_USER_ID is set,
// every request is treated as signed in as that user. This lets DB-backed
// feature tests run without the full Better Auth machinery. Never active in
// production (NODE_ENV is never "test" there).
async function getSessionUser(req) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.TEST_SESSION_USER_ID
  ) {
    return {
      user: { id: process.env.TEST_SESSION_USER_ID },
      session: { id: "test-session", userId: process.env.TEST_SESSION_USER_ID },
    };
  }

  const auth = await getAuth();
  if (!auth) return null;

  try {
    const result = await auth.api.getSession({ headers: toHeaders(req) });
    if (!result || !result.user) return null;
    return { user: result.user, session: result.session };
  } catch (err) {
    console.error(`getSession failed: ${err?.message || err}`);
    return null;
  }
}

// Route guard for signed-in-only features. Throws:
//   - 503 CONFIG_MISSING when the database or auth is not configured
//   - 401 UNAUTHORIZED "Sign in required." when there is no session
// Returns the resolved { user, session } otherwise.
async function requireSession(req) {
  if (!isDbConfigured() || !isAuthConfigured()) {
    throw configMissing();
  }
  const session = await getSessionUser(req);
  if (!session || !session.user) {
    throw new ApiError(ERROR_CODES.UNAUTHORIZED, "Sign in required.", {
      status: 401,
    });
  }
  return session;
}

module.exports = { getSessionUser, requireSession };
