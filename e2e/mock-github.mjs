// Mock GitHub API for Playwright e2e runs (port 4999).
//
// Serves the recorded fixtures in test/fixtures/github/*:
//   GET /users/:name        -> <name>_user.json
//   GET /users/:name/repos  -> <name>_repos.json (single page)
//
// Unknown users/routes get a GitHub-shaped 404. Header surface mirrors what
// lib/github.js reads: x-ratelimit-* on every response.
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = path.join(__dirname, "..", "test", "fixtures", "github");
const PORT = Number(process.env.MOCK_GITHUB_PORT || 4999);

const rateLimitHeaders = () => ({
  "x-ratelimit-limit": "60",
  "x-ratelimit-remaining": "59",
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
  "x-github-media-type": "github.v3; format=json",
});

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  const send = (status, body) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      ...rateLimitHeaders(),
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  const notFound = () =>
    send(404, {
      message: "Not Found",
      documentation_url: "https://docs.github.com/rest",
      status: "404",
    });

  if (req.method !== "GET") return notFound();

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "users" || !segments[1]) return notFound();

  const name = segments[1];
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return notFound();

  if (segments.length === 2) {
    const file = path.join(FIXTURES, `${name}_user.json`);
    if (!existsSync(file)) return notFound();
    return send(200, readFileSync(file, "utf8"));
  }

  if (segments.length === 3 && segments[2] === "repos") {
    const file = path.join(FIXTURES, `${name}_repos.json`);
    if (!existsSync(file)) return notFound();
    return send(200, readFileSync(file, "utf8"));
  }

  return notFound();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock github listening on http://127.0.0.1:${PORT}`);
});
