#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { createPool } = require("../lib/db");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");
// Session-level advisory lock id used by db/migrate.js across every
// environment; keep stable so different runners contend on the same lock.
const MIGRATION_LOCK_ID = 422019;

async function runMigrations({ logger = console } = {}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot run migrations.");
  }

  const pool = createPool(connectionString);
  let client;
  try {
    client = await pool.connect();
    // Lock the whole run: CI and a manual `npm run migrate` can race, and a
    // loser used to fail on the UNIQUE constraint even though it safely
    // rolled back. Blocks until any concurrent runner releases.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      const applied = new Set(
        (
          await client.query("SELECT name FROM schema_migrations")
        ).rows.map((row) => row.name)
      );

      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".sql"))
        .sort();

      for (const file of files) {
        if (applied.has(file)) {
          logger.log(`= ${file} (already applied)`);
          continue;
        }

        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations (name) VALUES ($1)",
            [file]
          );
          await client.query("COMMIT");
          logger.log(`+ ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(`Migration failed: ${err?.message || err}`);
      process.exit(1);
    });
}

module.exports = { runMigrations };
