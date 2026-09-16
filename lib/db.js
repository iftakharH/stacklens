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
function createPool(connectionString) {
  const options = { connectionString };
  if (!isLocalhost(connectionString)) {
    options.ssl = { rejectUnauthorized: false };
  }
  return new Pool(options);
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
