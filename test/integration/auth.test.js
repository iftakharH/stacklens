import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import request from "supertest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const AUTH_ENV_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "TRUSTED_ORIGINS",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "MAGIC_LINK_CAPTURE_FILE",
  "RATE_LIMIT_AUTH_ROUTES",
];

const savedEnv = new Map();

function saveEnv() {
  for (const key of AUTH_ENV_KEYS) savedEnv.set(key, process.env[key]);
}

function clearAuthEnv() {
  for (const key of AUTH_ENV_KEYS) delete process.env[key];
}

function restoreEnv() {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function loadApp() {
  const mod = await import("../../api/index.js");
  const app = mod.default ?? mod;
  if (typeof app !== "function") {
    throw new Error("api/index.js did not export a callable express app");
  }
  return app;
}

// ---------------------------------------------------------------------------
// Gating: with no auth env configured, the app must still boot and serve
// /health + analyze, while /api/auth/* returns 503 CONFIG_MISSING.
// Runs regardless of TEST_DATABASE_URL.
// ---------------------------------------------------------------------------

describe("auth gating (zero env)", () => {
  let app;

  beforeAll(async () => {
    saveEnv();
    clearAuthEnv();
    vi.resetModules();
    app = await loadApp();
  });

  afterAll(() => {
    restoreEnv();
  });

  it("returns 503 CONFIG_MISSING for any /api/auth/* path when auth is unconfigured", async () => {
    const res = await request(app).get("/api/auth/ok");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      ok: false,
      error: {
        code: "CONFIG_MISSING",
        message: "Feature not configured on this server.",
        retryable: false,
        status: 503,
      },
    });
  });

  it("still serves /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("still serves the analyze route (validation path, no auth env needed)", async () => {
    const res = await request(app).get("/api/analyze");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
  });
});

// ---------------------------------------------------------------------------
// Full magic-link flow against a real (test) Postgres.
// Skipped unless TEST_DATABASE_URL is provided.
// ---------------------------------------------------------------------------

describe.skipIf(!TEST_DATABASE_URL)(
  "auth magic-link flow (requires TEST_DATABASE_URL)",
  () => {
    let app;
    let captureFile;
    let tmpDir;
    let db;
    let sessionMod;

    const getDb = () => (db.getDb ?? db.default.getDb)();
    const endPool = () => (db.endPool ?? db.default.endPool)();
    const getSessionUser = (req) =>
      (sessionMod.getSessionUser ?? sessionMod.default.getSessionUser)(req);

    beforeAll(async () => {
      saveEnv();
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "stacklens-auth-"));
      captureFile = path.join(tmpDir, "magic-links.jsonl");

      process.env.DATABASE_URL = TEST_DATABASE_URL;
      process.env.BETTER_AUTH_SECRET =
        "test-secret-0123456789abcdef0123456789abcdef";
      process.env.BETTER_AUTH_URL = "http://localhost:4000";
      process.env.MAGIC_LINK_CAPTURE_FILE = captureFile;
      process.env.RATE_LIMIT_AUTH_ROUTES = "1000";
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      // Run the real migration script against the test DB.
      await promisify(execFile)(process.execPath, ["db/migrate.js"], {
        cwd: ROOT,
        env: process.env,
      });

      vi.resetModules();
      app = await loadApp();
      db = await import("../../lib/db.js");
      sessionMod = await import("../../lib/session.js");
    }, 60_000);

    afterAll(async () => {
      await endPool().catch(() => {});
      restoreEnv();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    beforeEach(async () => {
      fs.writeFileSync(captureFile, "");
      await getDb().query('DELETE FROM "verification"');
      await getDb().query('DELETE FROM "user"');
    });

    const readCapturedLink = () => {
      const lines = fs
        .readFileSync(captureFile, "utf8")
        .split("\n")
        .filter(Boolean);
      expect(lines.length).toBeGreaterThanOrEqual(1);
      return JSON.parse(lines[lines.length - 1]);
    };

    it("completes the full flow: magic link -> session -> getSessionUser -> sign-out", async () => {
      const email = `dev-${Date.now()}@example.com`;

      // 1. Request a magic link (sendEmail intercepted via capture file).
      const send = await request(app)
        .post("/api/auth/sign-in/magic-link")
        .send({ email, callbackURL: "/" });
      expect([200, 201]).toContain(send.status);

      const record = readCapturedLink();
      expect(record.email).toBe(email);

      const token = new URL(record.url).searchParams.get("token");
      expect(token).toBeTruthy();

      // 2. Verify the token -> session cookie is set.
      const verify = await request(app)
        .get("/api/auth/magic-link/verify")
        .query({ token, callbackURL: "/" });
      expect(verify.status).toBe(302);
      const setCookies = [].concat(verify.headers["set-cookie"] || []);
      expect(setCookies.length).toBeGreaterThanOrEqual(1);
      const cookieHeader = setCookies
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
      expect(cookieHeader).toContain("better-auth.session_token");

      // 3. The cookie resolves to a session via the auth endpoint...
      const session = await request(app)
        .get("/api/auth/get-session")
        .set("Cookie", cookieHeader);
      expect(session.status).toBe(200);
      expect(session.body?.user?.email).toBe(email);

      // ...and via lib/session.getSessionUser (wrapped req.headers).
      const found = await getSessionUser({
        headers: { cookie: cookieHeader },
      });
      expect(found).not.toBeNull();
      expect(found.user.email).toBe(email);
      expect(found.user.emailVerified).toBe(true);
      expect(found.session).toBeTruthy();

      // 4. Sign-out invalidates the session.
      const signOut = await request(app)
        .post("/api/auth/sign-out")
        .set("Cookie", cookieHeader);
      expect(signOut.status).toBe(200);

      const after = await request(app)
        .get("/api/auth/get-session")
        .set("Cookie", cookieHeader);
      expect(after.status).toBe(200);
      expect(after.body?.user ?? null).toBeNull();

      const viaHelper = await getSessionUser({
        headers: { cookie: cookieHeader },
      });
      expect(viaHelper).toBeNull();
    });

    it("rejects an invalid magic-link token", async () => {
      const verify = await request(app)
        .get("/api/auth/magic-link/verify")
        .query({ token: "not-a-real-token", callbackURL: "/" });
      if (verify.status === 302) {
        const location = verify.headers.location || "";
        expect(location).toContain("error=");
      } else {
        expect(verify.status).toBeGreaterThanOrEqual(400);
        expect(verify.status).toBeLessThan(500);
      }
    });
  }
);
