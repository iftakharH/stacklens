import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROFILES = ["octocat", "torvalds", "gaearon", "sindresorhus"];
const FIXTURES_DIR = path.join(ROOT, "test", "fixtures", "github");

const envPath = path.join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, value] = match;
    if (process.env[key] === undefined) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

const { fetchUser, fetchAllRepos } = await import("../lib/github.js");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(label, fn, attempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err && err.code === "NOT_FOUND") {
        throw new Error(
          `${label}: GitHub returned 404 (${err.message}) — the profile may have been renamed or deleted.`
        );
      }
      if (attempt < attempts) {
        const waitSec = 2 ** attempt;
        console.warn(
          `  ${label}: attempt ${attempt} failed (${err?.code || "UNKNOWN"}: ${err?.message}); retrying in ${waitSec}s...`
        );
        await sleep(waitSec * 1000);
      }
    }
  }
  throw lastErr;
}

await mkdir(FIXTURES_DIR, { recursive: true });

for (const name of PROFILES) {
  console.log(`Capturing fixtures for ${name}...`);
  let user;
  let repos;
  try {
    user = await withRetries(`${name} user`, () => fetchUser(name));
    repos = await withRetries(`${name} repos`, () => fetchAllRepos(name));
  } catch (err) {
    console.error(`\nFailed to capture fixtures for "${name}": ${err?.message || err}`);
    if (err?.code === "RATE_LIMITED") {
      console.error(
        "The GitHub API rate limit was hit. Set GITHUB_TOKEN in .env or in your environment, then re-run this script."
      );
    }
    process.exit(1);
  }

  await writeFile(
    path.join(FIXTURES_DIR, `${name}_user.json`),
    JSON.stringify(user, null, 2) + "\n",
    "utf8"
  );
  await writeFile(
    path.join(FIXTURES_DIR, `${name}_repos.json`),
    JSON.stringify(repos, null, 2) + "\n",
    "utf8"
  );
  console.log(
    `  wrote ${name}_user.json (${user.login}) and ${name}_repos.json (${repos.length} repos)`
  );
}

console.log("Done. Fixtures written to test/fixtures/github/");
