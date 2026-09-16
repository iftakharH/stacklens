import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const GITHUB_DIR = path.join(__dirname, "..", "fixtures", "github");
const GOLDEN_DIR = path.join(__dirname, "..", "fixtures", "golden");
const GOLDEN_NOW = new Date("2030-01-01T00:00:00.000Z");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function startMockGitHubServer() {
  let baseUrl = "";
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const segments = url.pathname.split("/").filter(Boolean);
    const send = (status, body, headers = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };

    if (req.method !== "GET" || segments[0] !== "users" || !segments[1]) {
      return send(404, { message: "Not Found" });
    }

    const name = segments[1];

    if (segments.length === 2) {
      if (name === "ghost") return send(404, { message: "Not Found" });
      if (name === "ratelimited") {
        return send(
          403,
          { message: "API rate limit exceeded" },
          { "x-ratelimit-remaining": "0", "retry-after": "42" }
        );
      }
      if (name === "broken") return send(500, { message: "Server Error" });
      const userFile = path.join(GITHUB_DIR, `${name}_user.json`);
      if (!existsSync(userFile)) return send(404, { message: "Not Found" });
      return send(200, readFileSync(userFile, "utf8"));
    }

    if (segments.length === 3 && segments[2] === "repos") {
      const reposFile = path.join(GITHUB_DIR, `${name}_repos.json`);
      if (!existsSync(reposFile)) return send(404, { message: "Not Found" });
      const repos = readJson(reposFile);
      if (name === "multi_page" && repos.length > 100) {
        const page = Number(url.searchParams.get("page")) || 1;
        if (page === 1) {
          return send(200, JSON.stringify(repos.slice(0, 100)), {
            link: `<${baseUrl}/users/multi_page/repos?page=2&per_page=100&sort=updated>; rel="next"`,
          });
        }
        return send(200, JSON.stringify(repos.slice(100)));
      }
      return send(200, JSON.stringify(repos));
    }

    return send(404, { message: "Not Found" });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, url: baseUrl });
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

process.env.GITHUB_API_BASE = mock.url;
process.env.RATE_LIMIT_ANON = "100";
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const app = await loadApp();

afterAll(async () => {
  await new Promise((resolve) => mock.server.close(resolve));
});

describe("GET /health", () => {
  it("returns 200 ok without rate limit headers", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});

describe("GET /api/analyze — golden parity", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: GOLDEN_NOW });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns the octocat envelope matching the golden report", async () => {
    const golden = readJson(path.join(GOLDEN_DIR, "octocat.report.json"));
    const res = await request(app).get("/api/analyze").query({ q: "octocat" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toEqual({
      ok: true,
      data: { username: "octocat", report: golden, report_id: null },
    });
  });

  it("accepts a github profile URL as q", async () => {
    const golden = readJson(path.join(GOLDEN_DIR, "octocat.report.json"));
    const res = await request(app)
      .get("/api/analyze")
      .query({ q: "https://github.com/octocat" });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe("octocat");
    expect(res.body.data.report).toEqual(golden);
  });

  it("handles a profile with zero repos", async () => {
    const golden = readJson(path.join(GOLDEN_DIR, "empty.report.json"));
    const res = await request(app).get("/api/analyze").query({ q: "empty" });
    expect(res.status).toBe(200);
    expect(res.body.data.report).toEqual(golden);
    expect(res.body.data.report.meta.repo_count).toBe(0);
  });

  it("handles a profile with only forks", async () => {
    const golden = readJson(path.join(GOLDEN_DIR, "forks_only.report.json"));
    const res = await request(app).get("/api/analyze").query({ q: "forks_only" });
    expect(res.status).toBe(200);
    expect(res.body.data.report).toEqual(golden);
  });

  it("follows pagination Link headers and merges all pages", async () => {
    const golden = readJson(path.join(GOLDEN_DIR, "multi_page.report.json"));
    const res = await request(app).get("/api/analyze").query({ q: "multi_page" });
    expect(res.status).toBe(200);
    expect(res.body.data.report.meta.repo_count).toBe(121);
    expect(res.body.data.report).toEqual(golden);
  });
});

describe("query validation", () => {
  it("rejects a missing q with 400 VALIDATION and details", async () => {
    const res = await request(app).get("/api/analyze");
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.status).toBe(400);
    expect(res.body.error.retryable).toBe(false);
    expect(res.body.error.details).toEqual([
      { path: "q", message: "Expected a GitHub username or profile URL string." },
    ]);
  });

  it("rejects an empty q", async () => {
    const res = await request(app).get("/api/analyze").query({ q: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.details[0].message).toBe(
      "Enter a GitHub username or profile URL."
    );
  });

  it("rejects q longer than 200 characters", async () => {
    const res = await request(app)
      .get("/api/analyze")
      .query({ q: "a".repeat(201) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.details[0].message).toBe(
      "Input must be 200 characters or fewer."
    );
  });

  it("rejects a github URL with no username", async () => {
    const res = await request(app)
      .get("/api/analyze")
      .query({ q: "https://github.com/" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.details[0].message).toBe(
      "Could not extract a GitHub username from the input."
    );
  });
});

describe("upstream GitHub errors", () => {
  it("maps a GitHub 404 to 404 NOT_FOUND", async () => {
    const res = await request(app).get("/api/analyze").query({ q: "ghost" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "GitHub user not found.",
        retryable: false,
        status: 404,
      },
    });
  });

  it("maps a GitHub rate-limited 403 to 429 RATE_LIMITED with Retry-After", async () => {
    const res = await request(app).get("/api/analyze").query({ q: "ratelimited" });
    expect(res.status).toBe(429);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("RATE_LIMITED");
    expect(res.body.error.retryable).toBe(true);
    expect(res.body.error.status).toBe(429);
    expect(res.body.error.message).toContain("rate limit");
    expect(res.headers["retry-after"]).toBe("42");
  });

  it("maps a GitHub 500 to 502 UPSTREAM_ERROR", async () => {
    const res = await request(app).get("/api/analyze").query({ q: "broken" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_ERROR");
    expect(res.body.error.retryable).toBe(true);
    expect(res.body.error.status).toBe(502);
  });
});

describe("CORS", () => {
  it("reflects the allowed local origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173"
    );
  });

  it("omits ACAO for a disallowed origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://evil.example");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("rate limiting with RATE_LIMIT_ANON=2", () => {
  let throttledApp;

  beforeAll(async () => {
    vi.resetModules();
    process.env.RATE_LIMIT_ANON = "2";
    throttledApp = await loadApp();
  });

  it("returns 429 with X-RateLimit headers on the 3rd request", async () => {
    const first = await request(throttledApp)
      .get("/api/analyze")
      .query({ q: "octocat" });
    expect(first.status).toBe(200);
    expect(first.headers["x-ratelimit-limit"]).toBe("2");
    expect(first.headers["x-ratelimit-remaining"]).toBe("1");

    const second = await request(throttledApp)
      .get("/api/analyze")
      .query({ q: "octocat" });
    expect(second.status).toBe(200);
    expect(second.headers["x-ratelimit-remaining"]).toBe("0");

    const third = await request(throttledApp)
      .get("/api/analyze")
      .query({ q: "octocat" });
    expect(third.status).toBe(429);
    expect(third.body.ok).toBe(false);
    expect(third.body.error.code).toBe("RATE_LIMITED");
    expect(third.body.error.retryable).toBe(true);
    expect(third.headers["x-ratelimit-limit"]).toBe("2");
    expect(third.headers["x-ratelimit-remaining"]).toBe("0");
    expect(third.headers["x-ratelimit-reset"]).toBeDefined();
    expect(third.headers["retry-after"]).toBeDefined();
  });
});
