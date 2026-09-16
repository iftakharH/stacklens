const express = require("express");
const { ApiError, ERROR_CODES } = require("../lib/errors");
const { query } = require("../lib/db");
const { requireSession } = require("../lib/session");
const { candidateBodySchema, parseBody, parseIdParam } = require("../lib/validation");

const router = express.Router();

// GET /api/candidates — the signed-in user's saved candidates, newest first.
router.get("/candidates", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const { rows } = await query(
      `SELECT id, github_username, note, created_at
         FROM candidates
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [user.id]
    );
    res.json({ ok: true, data: { items: rows } });
  } catch (err) {
    next(err);
  }
});

// POST /api/candidates — save (or re-save with a new note) a candidate.
router.post("/candidates", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const { github_username, note } = parseBody(
      candidateBodySchema,
      req.body,
      "Invalid candidate."
    );

    const { rows } = await query(
      `INSERT INTO candidates (user_id, github_username, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, github_username)
       DO UPDATE SET note = EXCLUDED.note, updated_at = now()
       RETURNING id, github_username, note, created_at`,
      [user.id, github_username, note ?? null]
    );

    res.status(201).json({ ok: true, data: { item: rows[0] } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/candidates/:id — remove one of the user's own candidates.
router.delete("/candidates/:id", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const id = parseIdParam(req.params.id, "id");

    const { rows } = await query(
      `DELETE FROM candidates
        WHERE id = $1 AND user_id = $2
        RETURNING id`,
      [id, user.id]
    );

    if (rows.length === 0) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, "Candidate not found.", {
        status: 404,
      });
    }

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
