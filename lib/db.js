const { Pool } = require("pg");
const { configMissing } = require("./errors");

function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function isLocalhost(connectionString) {
  try {
    const { hostname } = new URL(connectionString);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    );
  } catch {
    return true;
  }
}

// Plain connections for local Postgres, relaxed SSL for hosted ones (Neon etc.).
// Note: `rejectUnauthorized: false` is deliberate for now — Neon's pooled
// endpoint certs have made strict verification finicky behind proxies. The
// hostname is not attacker-controllable (env-configured), so this trades
// deeper TLS assurance for connection robustness until a pinned CA is added.
function createPool(connectionString) {
  const options = {
    connectionString,
    connectionTimeoutMillis: 10_000,
  };
  if (!isLocalhost(connectionString)) {
    options.ssl = { rejectUnauthorized: false };
  }
  const pool = new Pool(options);
  // pg's Pool emits 'error' for idle-client failures (providers routinely
  // close pooled sockets). Without a listener that becomes an uncaught
  // exception and can take down a warm lambda instance.
  pool.on("error", (err) => {
    console.error(`Postgres pool error (client discarded): ${err?.message || err}`);
  });
  return pool;
}

let pool = null;

// Lazy singleton. Throws a 503 CONFIG_MISSING ApiError when DATABASE_URL is unset.
// Never connects at require time — zero-env boots stay up.
function getDb() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw configMissing();
  }
  pool = createPool(connectionString);
  return pool;
}

async function query(text, params) {
  return getDb().query(text, params);
}

async function endPool() {
  if (!pool) return;
  const closing = pool;
  pool = null;
  await closing.end();
}

module.exports = { createPool, endPool, getDb, isDbConfigured, query };
