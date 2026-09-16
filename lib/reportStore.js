const crypto = require("node:crypto");
const { isDbConfigured, query } = require("./db");

// Dedupe key for a computed report: sha256 of its canonical JSON serialization.
// The same JS object always serializes identically, so two analyses of the
// same (unchanged) GitHub profile produce the same hash per user.
function hashReport(report) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(report))
    .digest("hex");
}

// Persists a computed report for a signed-in user. Unique is (user_id,
// sha256_hash), so the same content analyzed again maps to the same row.
// Returns the report row id, or null when nothing was persisted (no user,
// DB unconfigured, or a swallowed storage failure — analyze must never
// fail because history could not be written).
async function persistReport({ userId, githubUsername, report }) {
  if (!userId || !isDbConfigured()) return null;

  const sha256Hash = hashReport(report);

  try {
    let { rows } = await query(
      `INSERT INTO reports (github_username, report, sha256_hash, user_id)
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT (user_id, sha256_hash) DO NOTHING
       RETURNING id`,
      [githubUsername, JSON.stringify(report), sha256Hash, userId]
    );

    if (rows.length === 0) {
      ({ rows } = await query(
        `SELECT id FROM reports WHERE user_id = $1 AND sha256_hash = $2`,
        [userId, sha256Hash]
      ));
    }

    return rows[0]?.id ?? null;
  } catch (err) {
    console.error(`Failed to persist report: ${err?.message || err}`);
    return null;
  }
}

module.exports = { hashReport, persistReport };
