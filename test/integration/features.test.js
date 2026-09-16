import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import request from "supertest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const GITHUB_DIR = path.join(__dirname, "..", "fixtures", "github");
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const USER_A = "features-user-a";
const USER_B = "features-user-b";

const ENV_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "TRUSTED_ORIGINS",
  "TEST_SESSION_USER_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "MAGIC_LINK_CAPTURE_FILE",
  "RATE_LIMIT_ANON",
  "RATE_LIMIT_AUTH_ROUTES",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const savedEnv = new Map();

function saveEnv() {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
}

function restoreEnv() {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function startMockGitHubServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const segments = url.pathname.split("/").filter(Boolean);
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };

    if (req.method !== "GET" || segments[0] !== "users" || !segments[1]) {
      return send(404, { message: "Not Found" });
    }

    const name = segments[1];
    const userFile = path.join(GITHUB_DIR, `${name}_user.json`);
    const reposFile = path.join(GITHUB_DIR, `${name}_repos.json`);

    if (segments.length === 2) {
      if (!existsSync(userFile)) return send(404, { message: "Not Found" });
      return send(200, readFileSync(userFile, "utf8"));
    }

    if (segments.length === 3 && segments[2] === "repos") {
      if (!existsSync(reposFile)) return send(404, { message: "Not Found" });
      return send(200, JSON.stringify(readJson(reposFile)));
    }

    return send(404, { message: "Not Found" });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function loadApp() {
  const mod = await import("../../api/index.js");
  const app = mod.default ?? mod;
  if (typeof app !== "function") {
    throw new Error("api/index.js did not export a callable express app");
  }
  return app;
}

const mock = await startMockGitHubServer();
const mockUrl = mock.url;

const CONFIG_MISSING_ENVELOPE = {
  ok: false,
  error: {
    code: "CONFIG_MISSING",
    message: "Feature not configured on this server.",
    retryable: false,
    status: 503,
  },
};

// ---------------------------------------------------------------------------
// Gating: with no DB/auth configured the new protected routes return
// 503 CONFIG_MISSING while analyze keeps working with report_id null.
// Runs regardless of TEST_DATABASE_URL.
// ---------------------------------------------------------------------------

describe("feature gating (zero env)", () => {
  let app;

  beforeAll(async () => {
    saveEnv();
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.GITHUB_API_BASE = mockUrl;
    process.env.RATE_LIMIT_ANON = "100";
    vi.resetModules();
    app = await loadApp();
  });

  afterAll(() => {
    restoreEnv();
  });

  const protectedCases = [
    ["GET", "/api/candidates"],
    ["POST", "/api/candidates"],
    ["DELETE", "/api/candidates/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f"],
    ["GET", "/api/history"],
    ["GET", "/api/history/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f"],
    ["POST", "/api/share"],
    ["DELETE", "/api/shares/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f"],
  ];

  for (const [method, url] of protectedCases) {
    it(`returns 503 CONFIG_MISSING for ${method} ${url}`, async () => {
      const res = await request(app)[method.toLowerCase()](url);
      expect(res.status).toBe(503);
      expect(res.body).toEqual(CONFIG_MISSING_ENVELOPE);
    });
  }

  it("returns 503 CONFIG_MISSING for a public share lookup", async () => {
    const res = await request(app).get("/api/share/some-token");
    expect(res.status).toBe(503);
    expect(res.body).toEqual(CONFIG_MISSING_ENVELOPE);
  });

  it("still analyzes and returns report_id null when anonymous", async () => {
    const res = await request(app).get("/api/analyze").query({ q: "octocat" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.username).toBe("octocat");
    expect(res.body.data.report_id).toBeNull();
    expect(res.body.data.report.scores.overall).toBeTypeOf("number");
  });
});

// ---------------------------------------------------------------------------
// Full feature flow against a real (test) Postgres, using the
// TEST_SESSION_USER_ID override as the signed-in user.
// Skipped unless TEST_DATABASE_URL is provided.
// ---------------------------------------------------------------------------

describe.skipIf(!TEST_DATABASE_URL)(
  "candidate / history / share features (requires TEST_DATABASE_URL)",
  () => {
    let app;
    let db;
    const poolsToEnd = [];

    const query = (text, params) =>
      (db.query ?? db.default.query)(text, params);
    const endPools = async () => {
      for (const end of poolsToEnd) await end().catch(() => {});
    };

    beforeAll(async () => {
      saveEnv();
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      process.env.BETTER_AUTH_SECRET =
        "test-secret-0123456789abcdef0123456789abcdef";
      process.env.BETTER_AUTH_URL = "http://localhost:4000";
      process.env.GITHUB_API_BASE = mockUrl;
      process.env.RATE_LIMIT_ANON = "100";
      process.env.RATE_LIMIT_AUTH_ROUTES = "1000";
      process.env.TEST_SESSION_USER_ID = USER_A;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;

      // Run the real migration script against the test DB.
      await promisify(execFile)(process.execPath, ["db/migrate.js"], {
        cwd: ROOT,
        env: process.env,
      });

      vi.resetModules();
      app = await loadApp();
      db = await import("../../lib/db.js");
      poolsToEnd.push(db.endPool ?? db.default.endPool);
    }, 60_000);

    afterAll(async () => {
      await endPools();
      restoreEnv();
    });

    beforeEach(async () => {
      process.env.TEST_SESSION_USER_ID = USER_A;
      await query("DELETE FROM share_links");
      await query("DELETE FROM reports");
      await query("DELETE FROM candidates");
      await query('DELETE FROM "user"');
      await query(
        `INSERT INTO "user" (id, name, email, "emailVerified")
         VALUES ($1, 'Feature User A', 'a@example.com', true),
                ($2, 'Feature User B', 'b@example.com', true)`,
        [USER_A, USER_B]
      );
    });

    const analyze = (username) =>
      request(app).get("/api/analyze").query({ q: username });

    const sha256 = (value) =>
      crypto.createHash("sha256").update(value).digest("hex");

    describe("analyze persistence", () => {
      beforeAll(() => {
        vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-01T00:00:00.000Z") });
      });

      afterAll(() => {
        vi.useRealTimers();
      });

      it("persists the report for a signed-in user and returns report_id", async () => {
        const res = await analyze("octocat");
        expect(res.status).toBe(200);
        expect(res.body.data.report_id).toBeTruthy();

        const { rows } = await query(
          "SELECT id, github_username, report, sha256_hash, user_id FROM reports WHERE id = $1",
          [res.body.data.report_id]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].github_username).toBe("octocat");
        expect(rows[0].user_id).toBe(USER_A);
        expect(rows[0].report.scores.overall).toBe(
          res.body.data.report.scores.overall
        );
        expect(rows[0].sha256_hash).toBe(
          sha256(JSON.stringify(res.body.data.report))
        );
      });

      it("re-analyzing identical content dedupes to the same report row", async () => {
        const first = await analyze("octocat");
        const second = await analyze("octocat");
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(second.body.data.report_id).toBe(first.body.data.report_id);

        const { rows } = await query(
          "SELECT count(*)::int AS n FROM reports WHERE github_username = 'octocat'"
        );
        expect(rows[0].n).toBe(1);
      });

      it("stores the same content for two different users as two rows", async () => {
        const asA = await analyze("octocat");
        expect(asA.body.data.report_id).toBeTruthy();

        process.env.TEST_SESSION_USER_ID = USER_B;
        const asB = await analyze("octocat");
        expect(asB.body.data.report_id).toBeTruthy();
        expect(asB.body.data.report_id).not.toBe(asA.body.data.report_id);

        const { rows } = await query(
          "SELECT count(*)::int AS n FROM reports WHERE github_username = 'octocat'"
        );
        expect(rows[0].n).toBe(2);
      });
    });

    describe("candidates", () => {
      it("saves a candidate, upserts the note, lists, and deletes", async () => {
        const save = await request(app)
          .post("/api/candidates")
          .send({ github_username: "octocat", note: "first note" });
        expect(save.status).toBe(201);
        expect(save.body.ok).toBe(true);
        expect(save.body.data.item.github_username).toBe("octocat");
        expect(save.body.data.item.note).toBe("first note");
        const id = save.body.data.item.id;
        expect(id).toBeTruthy();

        const upsert = await request(app)
          .post("/api/candidates")
          .send({ github_username: "octocat", note: "second note" });
        expect(upsert.status).toBe(201);
        expect(upsert.body.data.item.id).toBe(id);
        expect(upsert.body.data.item.note).toBe("second note");

        const other = await request(app)
          .post("/api/candidates")
          .send({ github_username: "torvalds" });
        expect(other.status).toBe(201);
        expect(other.body.data.item.note).toBeNull();

        const list = await request(app).get("/api/candidates");
        expect(list.status).toBe(200);
        expect(list.body.data.items).toHaveLength(2);
        expect(list.body.data.items[0].github_username).toBe("torvalds");
        expect(list.body.data.items.map((i) => i.github_username)).toEqual(
          expect.arrayContaining(["octocat", "torvalds"])
        );

        const del = await request(app).delete(`/api/candidates/${id}`);
        expect(del.status).toBe(200);
        expect(del.body).toEqual({ ok: true, data: { deleted: true } });

        const after = await request(app).get("/api/candidates");
        expect(after.body.data.items).toHaveLength(1);
        expect(after.body.data.items[0].github_username).toBe("torvalds");
      });

      it("rejects invalid usernames and over-long notes with 400 VALIDATION", async () => {
        const badName = await request(app)
          .post("/api/candidates")
          .send({ github_username: "a--b" });
        expect(badName.status).toBe(400);
        expect(badName.body.error.code).toBe("VALIDATION");

        const longNote = await request(app)
          .post("/api/candidates")
          .send({ github_username: "octocat", note: "x".repeat(501) });
        expect(longNote.status).toBe(400);
        expect(longNote.body.error.code).toBe("VALIDATION");
      });

      it("returns 404 when deleting an unknown or foreign candidate", async () => {
        const save = await request(app)
          .post("/api/candidates")
          .send({ github_username: "octocat" });
        const id = save.body.data.item.id;

        const unknown = await request(app).delete(
          `/api/candidates/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f`
        );
        expect(unknown.status).toBe(404);
        expect(unknown.body.error.code).toBe("NOT_FOUND");

        process.env.TEST_SESSION_USER_ID = USER_B;
        const foreign = await request(app).delete(`/api/candidates/${id}`);
        expect(foreign.status).toBe(404);
        expect(foreign.body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("history", () => {
      let octocatId;
      let torvaldsId;
      let octocatReport;

      beforeAll(async () => {
        vi.useFakeTimers({ toFake: ["Date"], now: new Date("2030-01-01T00:00:00.000Z") });
      });

      afterAll(() => {
        vi.useRealTimers();
      });

      beforeEach(async () => {
        const octocat = await analyze("octocat");
        const torvalds = await analyze("torvalds");
        expect(octocat.status).toBe(200);
        expect(torvalds.status).toBe(200);
        octocatId = octocat.body.data.report_id;
        torvaldsId = torvalds.body.data.report_id;
        octocatReport = octocat.body.data.report;
      });

      it("lists persisted reports with extracted scores, newest first", async () => {
        const res = await request(app).get("/api/history");
        expect(res.status).toBe(200);
        const items = res.body.data.items;
        expect(items).toHaveLength(2);
        expect(items[0].id).toBe(torvaldsId);
        expect(items[1].id).toBe(octocatId);
        expect(items[1].github_username).toBe("octocat");
        expect(items[1].overall).toBe(octocatReport.scores.overall);
        expect(items[1].hireability).toBe(octocatReport.scores.hireability);
        expect(items[1].created_at).toBeTruthy();
      });

      it("supports limit and offset and rejects out-of-range values", async () => {
        const first = await request(app).get("/api/history?limit=1");
        expect(first.status).toBe(200);
        expect(first.body.data.items).toHaveLength(1);
        expect(first.body.data.items[0].id).toBe(torvaldsId);

        const second = await request(app).get("/api/history?limit=1&offset=1");
        expect(second.body.data.items).toHaveLength(1);
        expect(second.body.data.items[0].id).toBe(octocatId);

        const tooBig = await request(app).get("/api/history?limit=101");
        expect(tooBig.status).toBe(400);
        expect(tooBig.body.error.code).toBe("VALIDATION");

        const badOffset = await request(app).get("/api/history?offset=-1");
        expect(badOffset.status).toBe(400);
      });

      it("fetches one stored report by id for its owner", async () => {
        const res = await request(app).get(`/api/history/${octocatId}`);
        expect(res.status).toBe(200);
        expect(res.body.data.username).toBe("octocat");
        expect(res.body.data.report).toEqual(octocatReport);
        expect(res.body.data.created_at).toBeTruthy();
      });

      it("returns 404 for an unknown id and for another user's report", async () => {
        const unknown = await request(app).get(
          "/api/history/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f"
        );
        expect(unknown.status).toBe(404);
        expect(unknown.body.error.code).toBe("NOT_FOUND");

        process.env.TEST_SESSION_USER_ID = USER_B;
        const foreign = await request(app).get(`/api/history/${octocatId}`);
        expect(foreign.status).toBe(404);
      });
    });

    describe("share links", () => {
      let reportId;

      beforeEach(async () => {
        const res = await analyze("octocat");
        expect(res.status).toBe(200);
        reportId = res.body.data.report_id;
        expect(reportId).toBeTruthy();
      });

      it("creates a share link, serves it publicly, counts views, then deletes", async () => {
        const create = await request(app)
          .post("/api/share")
          .send({ report_id: reportId, expires_in_days: 7 });
        expect(create.status).toBe(201);
        const { token, path, id } = create.body.data;
        expect(token).toBeTruthy();
        expect(path).toBe(`/share/${token}`);
        expect(id).toBeTruthy();

        // Only the sha256 of the token is stored, never the raw token.
        const { rows: stored } = await query(
          "SELECT token_hash, expires_at, view_count FROM share_links WHERE id = $1",
          [id]
        );
        expect(stored[0].token_hash).toBe(sha256(token));
        expect(stored[0].view_count).toBe(0);
        expect(stored[0].expires_at).not.toBeNull();

        const view1 = await request(app).get(`/api/share/${token}`);
        expect(view1.status).toBe(200);
        expect(view1.body.data.username).toBe("octocat");
        expect(view1.body.data.report.scores).toBeTruthy();
        expect(view1.body.data.created_at).toBeTruthy();

        const view2 = await request(app).get(`/api/share/${token}`);
        expect(view2.status).toBe(200);

        const { rows: counted } = await query(
          "SELECT view_count FROM share_links WHERE id = $1",
          [id]
        );
        expect(counted[0].view_count).toBe(2);

        const revoke = await request(app).delete(`/api/shares/${id}`);
        expect(revoke.status).toBe(200);
        expect(revoke.body).toEqual({ ok: true, data: { deleted: true } });

        const gone = await request(app).get(`/api/share/${token}`);
        expect(gone.status).toBe(404);
        expect(gone.body.error.message).toBe(
          "Share link not found or expired."
        );
      });

      it("supports share links that never expire", async () => {
        const create = await request(app)
          .post("/api/share")
          .send({ report_id: reportId });
        expect(create.status).toBe(201);
        const { token, id } = create.body.data;

        const { rows } = await query(
          "SELECT expires_at FROM share_links WHERE id = $1",
          [id]
        );
        expect(rows[0].expires_at).toBeNull();

        const view = await request(app).get(`/api/share/${token}`);
        expect(view.status).toBe(200);
      });

      it("returns 404 once a link has expired", async () => {
        const create = await request(app)
          .post("/api/share")
          .send({ report_id: reportId, expires_in_days: 1 });
        const { token, id } = create.body.data;

        await query(
          "UPDATE share_links SET expires_at = now() - interval '1 minute' WHERE id = $1",
          [id]
        );

        const expired = await request(app).get(`/api/share/${token}`);
        expect(expired.status).toBe(404);
        expect(expired.body.error.message).toBe(
          "Share link not found or expired."
        );

        // An expired link can still be revoked by its owner.
        const revoke = await request(app).delete(`/api/shares/${id}`);
        expect(revoke.status).toBe(200);

        const after = await request(app).get(`/api/share/${token}`);
        expect(after.status).toBe(404);
      });

      it("rejects sharing someone else's or an unknown report", async () => {
        const foreign = await request(app)
          .post("/api/share")
          .send({ report_id: reportId });
        expect(foreign.status).toBe(201);
        process.env.TEST_SESSION_USER_ID = USER_B;

        const steal = await request(app)
          .post("/api/share")
          .send({ report_id: reportId });
        expect(steal.status).toBe(404);
        expect(steal.body.error.code).toBe("NOT_FOUND");

        const unknown = await request(app)
          .post("/api/share")
          .send({ report_id: "6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f" });
        expect(unknown.status).toBe(404);
      });

      it("rejects invalid bodies with 400 VALIDATION", async () => {
        const badId = await request(app)
          .post("/api/share")
          .send({ report_id: "not-a-uuid" });
        expect(badId.status).toBe(400);
        expect(badId.body.error.code).toBe("VALIDATION");

        const badDays = await request(app)
          .post("/api/share")
          .send({ report_id: reportId, expires_in_days: 31 });
        expect(badDays.status).toBe(400);
      });

      it("returns 404 for an unknown share id on DELETE", async () => {
        const res = await request(app).delete(
          "/api/shares/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f"
        );
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
      });
    });

    describe("without a session (auth configured, nobody signed in)", () => {
      let noSessionApp;

      beforeAll(async () => {
        delete process.env.TEST_SESSION_USER_ID;
        vi.resetModules();
        noSessionApp = await loadApp();
        db = await import("../../lib/db.js");
        poolsToEnd.push(db.endPool ?? db.default.endPool);
      });

      beforeEach(() => {
        // The outer beforeEach re-arms the session override before each test;
        // this suite must run with it off (runs after the outer hook).
        delete process.env.TEST_SESSION_USER_ID;
      });

      afterAll(() => {
        process.env.TEST_SESSION_USER_ID = USER_A;
      });

      it("returns 401 UNAUTHORIZED for protected routes", async () => {
        const cases = [
          ["get", "/api/candidates"],
          ["post", "/api/candidates"],
          ["get", "/api/history"],
          ["post", "/api/share"],
          ["delete", "/api/shares/6e8f1c0a-1b2d-4c3e-9f0a-7d6b5c4e3a2f"],
        ];
        for (const [method, url] of cases) {
          const res = await request(noSessionApp)[method](url);
          expect(res.status).toBe(401);
          expect(res.body).toEqual({
            ok: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Sign in required.",
              retryable: false,
              status: 401,
            },
          });
        }
      });

      it("does not persist reports for anonymous analyze", async () => {
        const res = await request(noSessionApp)
          .get("/api/analyze")
          .query({ q: "octocat" });
        expect(res.status).toBe(200);
        expect(res.body.data.report_id).toBeNull();
        const { rows } = await query("SELECT count(*)::int AS n FROM reports");
        expect(rows[0].n).toBe(0);
      });
    });
  }
);

afterAll(async () => {
  await new Promise((resolve) => mock.server.close(resolve));
});
