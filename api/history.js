const express = require("express");
const { ApiError, ERROR_CODES } = require("../lib/errors");
const { query } = require("../lib/db");
const { requireSession } = require("../lib/session");
const { historyQuerySchema, parseIdParam, parseQuery } = require("../lib/validation");

const router = express.Router();

// GET /api/history — the signed-in user's persisted reports, newest first.
// Overall + hireability are extracted from the stored JSONB in SQL.
router.get("/history", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const { limit, offset } = parseQuery(
      historyQuerySchema,
      req.query,
      "Invalid history query."
    );

    const { rows } = await query(
      `SELECT id,
              github_username,
              created_at,
              (report -> 'scores' ->> 'overall')::float8 AS overall,
              report -> 'scores' ->> 'hireability' AS hireability
         FROM reports
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    );

    res.json({ ok: true, data: { items: rows } });
  } catch (err) {
    next(err);
  }
});

// GET /api/history/:id — one stored report, owner-only.
router.get("/history/:id", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const id = parseIdParam(req.params.id, "id");

    const { rows } = await query(
      `SELECT github_username, report, created_at
         FROM reports
        WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    );

    if (rows.length === 0) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, "Report not found.", {
        status: 404,
      });
    }

    const row = rows[0];
    res.json({
      ok: true,
      data: {
        username: row.github_username,
        report: row.report,
        created_at: row.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
