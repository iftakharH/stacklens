import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GITHUB_DIR = path.join(ROOT, "test", "fixtures", "github");
const GOLDEN_DIR = path.join(ROOT, "test", "fixtures", "golden");

const GOLDEN_NOW = new Date("2030-01-01T00:00:00.000Z");
const PROFILES = [
  "octocat",
  "torvalds",
  "gaearon",
  "sindresorhus",
  "empty",
  "forks_only",
  "multi_page",
];

const { computeReport } = await import("../lib/report.js");

await mkdir(GOLDEN_DIR, { recursive: true });

for (const name of PROFILES) {
  const user = JSON.parse(
    await readFile(path.join(GITHUB_DIR, `${name}_user.json`), "utf8")
  );
  const repos = JSON.parse(
    await readFile(path.join(GITHUB_DIR, `${name}_repos.json`), "utf8")
  );

  const report = computeReport(user, repos, GOLDEN_NOW);
  const file = path.join(GOLDEN_DIR, `${name}.report.json`);
  await writeFile(file, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(
    `wrote golden/${name}.report.json (overall ${report.scores.overall}, ${report.meta.repo_count} repos, hireability ${report.scores.hireability})`
  );
}

console.log("Done. Goldens written to test/fixtures/golden/");
