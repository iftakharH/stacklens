import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import reportModule from "../../lib/report.js";

const { computeReport } = reportModule;

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const GITHUB_DIR = path.join(__dirname, "..", "fixtures", "github");
const GOLDEN_DIR = path.join(__dirname, "..", "fixtures", "golden");

const FIXED_NOW = new Date("2030-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const GOLDEN_PROFILES = [
  "octocat",
  "torvalds",
  "gaearon",
  "sindresorhus",
  "empty",
  "forks_only",
  "multi_page",
];

const daysAgoIso = (days) =>
  new Date(FIXED_NOW.getTime() - days * DAY_MS).toISOString();

function makeUser(overrides = {}) {
  return {
    login: "testuser",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    html_url: "https://github.com/testuser",
    name: "Test User",
    bio: null,
    followers: 0,
    following: 0,
    public_repos: 0,
    created_at: "2020-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRepo(overrides = {}) {
  return {
    id: 1,
    name: "repo-1",
    full_name: "testuser/repo-1",
    html_url: "https://github.com/testuser/repo-1",
    description: "A test repo",
    fork: false,
    created_at: "2020-06-01T00:00:00Z",
    updated_at: "2029-12-01T00:00:00Z",
    pushed_at: daysAgoIso(10),
    size: 100,
    stargazers_count: 0,
    language: "JavaScript",
    ...overrides,
  };
}

const buildRepos = (count, overrides = {}) =>
  Array.from({ length: count }, (_, i) =>
    makeRepo({ id: i + 1, name: `repo-${i + 1}`, ...overrides })
  );

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

describe("computeReport golden parity", () => {
  for (const name of GOLDEN_PROFILES) {
    it(`matches the golden report for ${name}`, () => {
      const user = readJson(path.join(GITHUB_DIR, `${name}_user.json`));
      const repos = readJson(path.join(GITHUB_DIR, `${name}_repos.json`));
      const golden = readJson(path.join(GOLDEN_DIR, `${name}.report.json`));
      const report = computeReport(user, repos, FIXED_NOW);
      expect(JSON.stringify(report)).toBe(JSON.stringify(golden));
    });
  }
});

describe("activity score boundaries", () => {
  const cases = [
    [null, 0],
    [1000, 0],
    [365, 0],
    [364, 2],
    [180, 2],
    [179, 4],
    [90, 4],
    [89, 6],
    [30, 6],
    [29, 8],
    [7, 8],
    [6, 10],
    [0, 10],
  ];

  for (const [days, expected] of cases) {
    it(`scores activity ${expected} when last push was ${days ?? "never"} days ago`, () => {
      const repos = [
        makeRepo(days === null ? { pushed_at: null } : { pushed_at: daysAgoIso(days) }),
      ];
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      expect(report.scores.activity).toBe(expected);
    });
  }

  it("scores activity 0 when there are no repos", () => {
    const report = computeReport(makeUser(), [], FIXED_NOW);
    expect(report.scores.activity).toBe(0);
    expect(report.overview.last_activity_days).toBeNull();
  });

  it("rounds last_activity_days to whole days (6.9 -> 7)", () => {
    const repos = [makeRepo({ pushed_at: daysAgoIso(6.9) })];
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.overview.last_activity_days).toBe(7);
    expect(report.scores.activity).toBe(10);
  });
});

describe("project quality: repo points", () => {
  const cases = [
    [0, 0],
    [1, 1],
    [2, 2],
    [5, 3],
    [10, 4],
    [20, 5],
  ];

  for (const [count, repoPts] of cases) {
    it(`gives repoPts ${repoPts} for ${count} repos`, () => {
      const repos = buildRepos(count, { pushed_at: daysAgoIso(5) });
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      const expectedQuality = count === 0 ? 0 : repoPts + 2;
      expect(report.scores.projectQuality).toBe(expectedQuality);
    });
  }
});

describe("project quality: star points", () => {
  const cases = [
    [0, 0],
    [5, 1],
    [25, 2],
    [100, 3],
  ];

  for (const [totalStars, starPts] of cases) {
    it(`gives starPts ${starPts} for ${totalStars} total stars`, () => {
      const repos = buildRepos(5, { pushed_at: daysAgoIso(5) });
      repos[0].stargazers_count = totalStars;
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      expect(report.scores.projectQuality).toBe(3 + starPts + 2);
      expect(report.meta.total_stars).toBe(totalStars);
    });
  }
});

describe("project quality: description points", () => {
  const cases = [
    [3, 0, 2],
    [2, 1, 3],
    [3, 2, 3],
    [5, 4, 5],
  ];

  for (const [count, withDesc, expectedQuality] of cases) {
    it(`gives quality ${expectedQuality} when ${withDesc}/${count} repos have descriptions`, () => {
      const repos = buildRepos(count, { pushed_at: daysAgoIso(5) }).map((repo, i) =>
        i < withDesc ? repo : { ...repo, description: null }
      );
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      expect(report.scores.projectQuality).toBe(expectedQuality);
    });
  }
});

describe("stack diversity", () => {
  const cases = [
    [0, 0],
    [1, 2],
    [2, 4],
    [3, 6],
    [5, 10],
    [7, 10],
  ];
  const LANGS = ["JavaScript", "Python", "Rust", "Go", "CSS", "Ruby", "Java"];

  for (const [distinct, expected] of cases) {
    it(`scores ${expected} for ${distinct} distinct languages`, () => {
      const repos = Array.from({ length: distinct }, (_, i) =>
        makeRepo({ id: i + 1, name: `repo-${i + 1}`, language: LANGS[i], pushed_at: daysAgoIso(5) })
      );
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      expect(report.scores.stackDiversity).toBe(expected);
    });
  }

  it("counts repos without a language as Other", () => {
    const repos = [
      makeRepo({ id: 1, name: "a", language: "JavaScript" }),
      makeRepo({ id: 2, name: "b", language: null }),
    ];
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.scores.stackDiversity).toBe(4);
    expect(report.stack.language_distribution).toHaveLength(2);
  });

  it("weights languages by repo size and computes distribution", () => {
    const repos = [
      makeRepo({ id: 1, name: "big-js", language: "JavaScript", size: 300 }),
      makeRepo({ id: 2, name: "small-js", language: "JavaScript", size: 100 }),
      makeRepo({ id: 3, name: "py", language: "Python", size: 100 }),
      makeRepo({ id: 4, name: "tiny-rs", language: "Rust", size: 0 }),
    ];
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.stack.primary_language).toBe("JavaScript");
    expect(report.stack.secondary_language).toBe("Python");
    expect(report.stack.language_distribution).toEqual([
      { language: "JavaScript", count: 400, percentage: 79.8 },
      { language: "Python", count: 100, percentage: 20 },
      { language: "Rust", count: 1, percentage: 0.2 },
    ]);
  });
});

describe("overall score and hireability labels", () => {
  it("computes overall = A*0.25 + S*0.25 + Q*0.5 rounded once to 1 decimal", () => {
    const repos = buildRepos(20, { pushed_at: daysAgoIso(5) });
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.scores.activity).toBe(10);
    expect(report.scores.stackDiversity).toBe(2);
    expect(report.scores.projectQuality).toBe(7);
    expect(report.scores.overall).toBe(6.5);
    expect(report.scores.hireability).toBe("Junior Ready");
  });

  const labelCases = [
    ["Beginner", 1, ["JavaScript"], null, false, 0],
    ["Developing", 1, ["JavaScript"], 5, true, 0],
    ["Junior Ready", 5, ["JavaScript", "Python"], 5, true, 0],
    ["Strong Junior", 5, ["JavaScript", "Python", "Rust", "Go"], 5, true, 0],
    ["Hireable", 5, ["JavaScript", "Python", "Rust", "Go"], 5, true, 100],
  ];

  for (const [label, count, langs, pushedDays, withDesc, stars] of labelCases) {
    it(`labels overall as ${label}`, () => {
      const repos = Array.from({ length: count }, (_, i) =>
        makeRepo({
          id: i + 1,
          name: `repo-${i + 1}`,
          language: langs[i % langs.length],
          pushed_at: pushedDays === null ? null : daysAgoIso(pushedDays),
          description: withDesc ? "A test repo" : null,
          stargazers_count: i === 0 ? stars : 0,
        })
      );
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      expect(report.scores.hireability).toBe(label);
    });
  }
});

describe("summary and insights branches", () => {
  it("flags a small portfolio (<5 repos) when other signals are healthy", () => {
    const repos = [
      makeRepo({ id: 1, name: "a", language: "JavaScript", size: 300, stargazers_count: 4, pushed_at: daysAgoIso(45) }),
      makeRepo({ id: 2, name: "b", language: "Python", size: 200, stargazers_count: 3, pushed_at: daysAgoIso(45) }),
      makeRepo({ id: 3, name: "c", language: "Rust", size: 100, stargazers_count: 3, pushed_at: daysAgoIso(45) }),
    ];
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.insights).toEqual([
      "Small portfolio — add more public projects for stronger signal.",
    ]);
    expect(report.summary).toBe(
      "Developer with a JavaScript-focused public portfolio (3 repos, 3 language(s)). Shows recent activity with periodic updates. Opportunity: more real-world projects."
    );
  });

  it("flags missing documentation when desc ratio < 0.5", () => {
    const repos = buildRepos(5, { pushed_at: daysAgoIso(45) }).map((repo, i) => ({
      ...repo,
      language: ["JavaScript", "Python", "Rust"][i % 3],
      description: i < 2 ? "A test repo" : null,
      stargazers_count: i === 0 ? 10 : 0,
    }));
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.insights).toEqual([
      "Projects lack documentation — many repos are missing descriptions.",
    ]);
    expect(report.summary).toContain("Opportunity: better project documentation.");
    expect(report.summary).not.toContain("more real-world projects");
  });

  it("flags low visibility when total stars < 5", () => {
    const repos = buildRepos(5, { pushed_at: daysAgoIso(45) }).map((repo, i) => ({
      ...repo,
      language: ["JavaScript", "Python", "Rust"][i % 3],
    }));
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.insights).toEqual([
      "Low visibility — few stars across repositories.",
    ]);
    expect(report.summary).toContain("Opportunity: more visibility (stars).");
  });

  it("falls back to the balanced insight when no red flags exist", () => {
    const repos = buildRepos(5, { pushed_at: daysAgoIso(45) }).map((repo, i) => ({
      ...repo,
      language: ["JavaScript", "Python", "Rust"][i % 3],
      size: i === 0 ? 300 : 100,
      description: i < 3 ? "A test repo" : null,
      stargazers_count: i === 0 ? 6 : 0,
    }));
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.insights).toEqual([
      "Balanced signals — no major red flags in public activity, stack, or documentation.",
    ]);
    expect(report.summary).toBe(
      "Developer with a JavaScript-focused public portfolio (5 repos, 3 language(s)). Shows recent activity with periodic updates. Profile is well-rounded with good public signals."
    );
  });

  it("combines multiple improvement bits in order", () => {
    const repos = buildRepos(2, { pushed_at: daysAgoIso(45), description: null });
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.summary).toContain(
      "Opportunity: more real-world projects, better project documentation, more visibility (stars)."
    );
  });

  const activityLineCases = [
    [null, "Activity signal is limited (no recent push data found)."],
    [10, "Actively pushing code with recent updates."],
    [45, "Shows recent activity with periodic updates."],
    [200, "Low recent activity — would benefit from more consistent contributions."],
  ];

  for (const [days, line] of activityLineCases) {
    it(`summary activity line: ${line}`, () => {
      const repos = [makeRepo({ pushed_at: days === null ? null : daysAgoIso(days) })];
      const report = computeReport(makeUser(), repos, FIXED_NOW);
      expect(report.summary).toContain(line);
    });
  }

  it("calls TypeScript profiles JavaScript-focused", () => {
    const repos = [makeRepo({ language: "TypeScript" })];
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.summary).toContain("JavaScript-focused");
  });

  it("uses '<Lang>-focused' for other primary languages", () => {
    const repos = [makeRepo({ language: "Python", size: 999 })];
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.summary).toContain("Python-focused");
  });

  it("uses multi-language when there is no primary language", () => {
    const report = computeReport(makeUser(), [], FIXED_NOW);
    expect(report.summary).toContain("multi-language");
  });
});

describe("overview fields", () => {
  it("computes account age in years from created_at", () => {
    const report = computeReport(makeUser({ created_at: "2020-01-01T00:00:00Z" }), [makeRepo()], FIXED_NOW);
    expect(report.overview.account_age_years).toBe(10);
  });

  it("returns null account age when created_at is missing", () => {
    const report = computeReport(makeUser({ created_at: null }), [makeRepo()], FIXED_NOW);
    expect(report.overview.account_age_years).toBeNull();
  });

  it("passes through profile fields and turns empty bio into null", () => {
    const user = makeUser({ bio: "", followers: 12, following: 34, name: "Someone" });
    const report = computeReport(user, [makeRepo()], FIXED_NOW);
    expect(report.overview.bio).toBeNull();
    expect(report.overview.followers).toBe(12);
    expect(report.overview.following).toBe(34);
    expect(report.overview.name).toBe("Someone");
    expect(report.overview.username).toBe("testuser");
    expect(report.meta.follower_count).toBe(12);
  });
});

describe("repo highlights", () => {
  it("returns the top 5 repos by stars with the expected shape", () => {
    const stars = [100, 50, 25, 10, 5, 0];
    const repos = stars.map((s, i) =>
      makeRepo({
        id: i + 1,
        name: `repo-${i + 1}`,
        stargazers_count: s,
        pushed_at: i === 4 ? null : daysAgoIso(10),
        updated_at: "2029-11-11T00:00:00Z",
      })
    );
    repos[5].stargazers_count = undefined;
    const report = computeReport(makeUser(), repos, FIXED_NOW);
    expect(report.highlights).toHaveLength(5);
    expect(report.highlights.map((h) => h.stars)).toEqual([100, 50, 25, 10, 5]);
    expect(report.highlights[4].updated_at).toBe("2029-11-11T00:00:00Z");
    expect(Object.keys(report.highlights[0])).toEqual([
      "id",
      "name",
      "description",
      "stars",
      "html_url",
      "language",
      "updated_at",
    ]);
    expect(report.meta.total_stars).toBe(190);
    expect(report.meta.repo_count).toBe(6);
  });
});
