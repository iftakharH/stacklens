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

const CHECK_MODE = process.argv.includes("--check");
if (CHECK_MODE) {
  console.log(
    "Running in --check mode: no files are written; exits 1 if any golden would change."
  );
}

await mkdir(GOLDEN_DIR, { recursive: true });

let drift = 0;

for (const name of PROFILES) {
  const user = JSON.parse(
    await readFile(path.join(GITHUB_DIR, `${name}_user.json`), "utf8")
  );
  const repos = JSON.parse(
    await readFile(path.join(GITHUB_DIR, `${name}_repos.json`), "utf8")
  );

  const report = computeReport(user, repos, GOLDEN_NOW);
  const serialized = JSON.stringify(report, null, 2) + "\n";
  const file = path.join(GOLDEN_DIR, `${name}.report.json`);

  if (CHECK_MODE) {
    let current;
    try {
      current = await readFile(file, "utf8");
    } catch {
      current = null;
    }
    if (current !== serialized) {
      drift += 1;
      console.error(
        `DRIFT: ${path.relative(ROOT, file)} ${current === null ? "is missing" : "would change"} under the current engine.`
      );
    }
  } else {
    await writeFile(file, serialized, "utf8");
    console.log(
      `wrote golden/${name}.report.json (overall ${report.scores.overall}, ${report.meta.repo_count} repos, hireability ${report.scores.hireability})`
    );
  }
}

if (CHECK_MODE) {
  if (drift > 0) {
    console.error(
      `Golden check FAILED: ${drift} golden(s) drift from the engine. Run 'node scripts/generate-goldens.mjs' and commit the diff deliberately.`
    );
    process.exit(1);
  }
  console.log("Golden check passed: no drift.");
} else {
  console.log("Done. Goldens written to test/fixtures/golden/");
}
