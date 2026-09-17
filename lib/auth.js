const fs = require("node:fs");
const { getDb } = require("./db");

// Better Auth is ESM-only and this repo is CommonJS, so it is loaded with
// dynamic import() inside a lazy async initializer. Nothing here connects to
// the database or imports better-auth until the first auth request, and only
// when auth is fully configured.

let authInstance = null;
let authPromise = null;
let handlerPromise = null;
let magicLinkCapture = null;

function isAuthConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}

// Test hook: capture outgoing magic-link emails programmatically.
function setMagicLinkCapture(fn) {
  magicLinkCapture = typeof fn === "function" ? fn : null;
}

function magicLinkEmailEnabled() {
  return Boolean(
    magicLinkCapture ||
      process.env.MAGIC_LINK_CAPTURE_FILE ||
      (process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  );
}

// Where Better Auth sends a visitor when a sign-in attempt fails. Without this
// it redirects to `${baseURL}/api/auth/error` — the API origin — so the user
// never gets back to the product. Prefers APP_ORIGIN (the SPA), then the first
// trusted origin.
function appOrigin() {
  const explicit = (process.env.APP_ORIGIN || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const first = (process.env.TRUSTED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first ? first.replace(/\/+$/, "") : null;
}

async function sendMagicLinkEmail({ email, url, token }) {
  const record = { email, url, token, sentAt: new Date().toISOString() };

  if (magicLinkCapture) {
    magicLinkCapture(record);
  }

  if (process.env.MAGIC_LINK_CAPTURE_FILE) {
    fs.appendFileSync(
      process.env.MAGIC_LINK_CAPTURE_FILE,
      `${JSON.stringify(record)}\n`
    );
    // Local-dev convenience: without a mail provider the link is only in the
    // capture file, so surface it in the terminal the dev server runs in.
    console.log(`[dev] Magic link for ${email}: ${url}`);
  }

  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: "Your StackLens sign-in link",
        html: `<p>Click below to sign in to StackLens. The link expires in 5 minutes.</p><p><a href="${url}">Sign in to StackLens</a></p>`,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Resend email delivery failed (${resp.status}).`);
    }
  }
}

async function buildAuth() {
  const { betterAuth } = await import("better-auth");
  const { magicLink } = await import("better-auth/plugins");

  const trustedOrigins = [
    "http://localhost:5173",
    ...(process.env.TRUSTED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ];

  const githubConfigured = Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
  );

  const plugins = [];
  if (magicLinkEmailEnabled()) {
    plugins.push(magicLink({ sendMagicLink: sendMagicLinkEmail }));
  }

  const origin = appOrigin();

  return betterAuth({
    database: getDb(),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
    trustedOrigins,
    emailAndPassword: { enabled: false },
    // Failed sign-ins return to the app with ?error=<code> instead of
    // stranding the visitor on the API origin.
    onAPIError: origin ? { errorURL: `${origin}/?authError=1` } : undefined,
    socialProviders: githubConfigured
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {},
    plugins,
  });
}

// Returns the Better Auth instance, or null when auth is not configured
// (zero-env boot must degrade gracefully, never crash).
async function getAuth() {
  if (!isAuthConfigured()) return null;
  if (authInstance) return authInstance;
  if (!authPromise) {
    authPromise = buildAuth().catch((err) => {
      authPromise = null;
      throw err;
    });
  }
  authInstance = await authPromise;
  return authInstance;
}

// Returns a Node-style (req, res) handler for Express, or null when
// auth is not configured.
async function getAuthHandler() {
  if (!isAuthConfigured()) return null;
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const auth = await getAuth();
      const { toNodeHandler } = await import("better-auth/node");
      return toNodeHandler(auth);
    })().catch((err) => {
      handlerPromise = null;
      throw err;
    });
  }
  return handlerPromise;
}

module.exports = {
  getAuth,
  getAuthHandler,
  isAuthConfigured,
  setMagicLinkCapture,
};
