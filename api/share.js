const crypto = require("node:crypto");
const express = require("express");
const { ApiError, ERROR_CODES, configMissing } = require("../lib/errors");
const { isDbConfigured, query } = require("../lib/db");
const { requireSession } = require("../lib/session");
const { parseBody, parseIdParam, shareBodySchema } = require("../lib/validation");

const router = express.Router();

const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

// POST /api/share — create a share link for one of the user's own reports.
// The raw token is returned exactly once; only sha256(token) is stored.
router.post("/share", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const { report_id, expires_in_days } = parseBody(
      shareBodySchema,
      req.body,
      "Invalid share link request."
    );

    const owned = await query(
      `SELECT id FROM reports WHERE id = $1 AND user_id = $2`,
      [report_id, user.id]
    );
    if (owned.rows.length === 0) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, "Report not found.", {
        status: 404,
      });
    }

    const token = crypto.randomBytes(32).toString("base64url");

    const { rows } = await query(
      `INSERT INTO share_links (report_id, token_hash, created_by, expires_at)
       VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL
                                THEN NULL
                                ELSE now() + make_interval(days => $4::int) END)
       RETURNING id`,
      [report_id, sha256(token), user.id, expires_in_days ?? null]
    );

    res.status(201).json({
      ok: true,
      data: { token, path: `/share/${token}`, id: rows[0].id },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/share/:token — PUBLIC. Resolves a share link to its report and
// bumps view_count atomically. Unknown or expired tokens are
// indistinguishable (404) so links cannot be probed.
router.get("/share/:token", async (req, res, next) => {
  try {
    if (!isDbConfigured()) throw configMissing();

    const tokenHash = sha256(String(req.params.token || ""));

    const { rows } = await query(
      `WITH hit AS (
         UPDATE share_links
            SET view_count = view_count + 1
          WHERE token_hash = $1
            AND (expires_at IS NULL OR expires_at > now())
          RETURNING report_id
       )
       SELECT r.github_username, r.report, r.created_at
         FROM hit
         JOIN reports r ON r.id = hit.report_id`,
      [tokenHash]
    );

    if (rows.length === 0) {
      throw new ApiError(
        ERROR_CODES.NOT_FOUND,
        "Share link not found or expired.",
        { status: 404 }
      );
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

// DELETE /api/shares/:id — revoke a share link. Allowed for the link creator
// (created_by) or the owner of the underlying report (reports.user_id).
router.delete("/shares/:id", async (req, res, next) => {
  try {
    const { user } = await requireSession(req);
    const id = parseIdParam(req.params.id, "id");

    const { rows } = await query(
      `DELETE FROM share_links s
        WHERE s.id = $1
          AND (
            s.created_by = $2
            OR EXISTS (
              SELECT 1 FROM reports r
               WHERE r.id = s.report_id AND r.user_id = $2
            )
          )
        RETURNING s.id`,
      [id, user.id]
    );

    if (rows.length === 0) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, "Share link not found.", {
        status: 404,
      });
    }

    res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
