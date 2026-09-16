import { describe, expect, it } from "vitest";
import validationModule from "../../lib/validation.js";

const { analyzeQuerySchema, extractUsernameFromUrl, parseAnalyzeQuery } = validationModule;

describe("extractUsernameFromUrl", () => {
  it("returns a plain username untouched", () => {
    expect(extractUsernameFromUrl("octocat")).toBe("octocat");
  });

  it("trims surrounding whitespace from a plain username", () => {
    expect(extractUsernameFromUrl("  octocat ")).toBe("octocat");
  });

  it("extracts the user from an https github profile URL", () => {
    expect(extractUsernameFromUrl("https://github.com/user")).toBe("user");
  });

  it("extracts the user from an https github repo URL", () => {
    expect(extractUsernameFromUrl("https://github.com/user/repo")).toBe("user");
  });

  it("ignores a trailing slash", () => {
    expect(extractUsernameFromUrl("https://github.com/user/")).toBe("user");
  });

  it("takes the first path segment from a scheme-less github URL", () => {
    expect(extractUsernameFromUrl("github.com/octocat")).toBe("octocat");
  });

  it("keeps current last-segment behavior for scheme-less repo paths", () => {
    expect(extractUsernameFromUrl("github.com/user/repo")).toBe("repo");
  });

  it("falls back to the first segment for non-github URLs", () => {
    expect(extractUsernameFromUrl("https://gitlab.com/foo")).toBe("foo");
  });

  it("returns null for empty and whitespace-only input", () => {
    expect(extractUsernameFromUrl("")).toBeNull();
    expect(extractUsernameFromUrl("   ")).toBeNull();
    expect(extractUsernameFromUrl(null)).toBeNull();
    expect(extractUsernameFromUrl(undefined)).toBeNull();
  });

  it("returns null when the URL has no path segments", () => {
    expect(extractUsernameFromUrl("https://github.com/")).toBeNull();
    expect(extractUsernameFromUrl("/")).toBeNull();
  });

  it("keeps current last-segment behavior for bare scheme garbage", () => {
    expect(extractUsernameFromUrl("http://")).toBe("http:");
  });
});

describe("analyzeQuerySchema", () => {
  it("accepts a valid username", () => {
    const result = analyzeQuerySchema.safeParse({ q: "octocat" });
    expect(result.success).toBe(true);
    expect(result.data.q).toBe("octocat");
  });

  it("trims before validating", () => {
    const result = analyzeQuerySchema.safeParse({ q: "  octocat " });
    expect(result.success).toBe(true);
    expect(result.data.q).toBe("octocat");
  });

  it("accepts input up to 200 characters", () => {
    const result = analyzeQuerySchema.safeParse({ q: "a".repeat(200) });
    expect(result.success).toBe(true);
  });

  it("rejects input over 200 characters", () => {
    const result = analyzeQuerySchema.safeParse({ q: "a".repeat(201) });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(
      "Input must be 200 characters or fewer."
    );
  });

  it("rejects an empty string", () => {
    const result = analyzeQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(
      "Enter a GitHub username or profile URL."
    );
  });

  it("rejects whitespace-only input", () => {
    const result = analyzeQuerySchema.safeParse({ q: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects non-string and missing q", () => {
    expect(analyzeQuerySchema.safeParse({ q: 123 }).success).toBe(false);
    expect(analyzeQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("parseAnalyzeQuery", () => {
  it("parses a plain username", () => {
    expect(parseAnalyzeQuery({ q: "octocat" })).toEqual({ username: "octocat" });
  });

  it("parses a github profile URL with whitespace", () => {
    expect(parseAnalyzeQuery({ q: "  https://github.com/octocat  " })).toEqual({
      username: "octocat",
    });
  });

  it("parses a github repo URL to its owner", () => {
    expect(parseAnalyzeQuery({ q: "https://github.com/octocat/Spoon-Knife" })).toEqual({
      username: "octocat",
    });
  });

  it("accepts non-github URLs by extracting the first segment", () => {
    expect(parseAnalyzeQuery({ q: "https://gitlab.com/foo" })).toEqual({
      username: "foo",
    });
  });

  const invalidCases = [
    ["missing q", undefined],
    ["null query", null],
    ["empty q", ""],
    ["whitespace-only q", "   "],
    ["over-length q", "a".repeat(201)],
    ["extraction failure", "https://github.com/"],
  ];

  for (const [label, q] of invalidCases) {
    it(`throws a VALIDATION ApiError for ${label}`, () => {
      let err;
      try {
        parseAnalyzeQuery(q === undefined ? {} : { q });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("ApiError");
      expect(err.code).toBe("VALIDATION");
      expect(err.status).toBe(400);
      expect(Array.isArray(err.details)).toBe(true);
      expect(err.details[0].path).toBe("q");
    });
  }

  it("reports the length message for over-length input", () => {
    let err;
    try {
      parseAnalyzeQuery({ q: "a".repeat(201) });
    } catch (e) {
      err = e;
    }
    expect(err.details[0].message).toBe("Input must be 200 characters or fewer.");
  });

  it("reports the extraction message for URLs without a username", () => {
    let err;
    try {
      parseAnalyzeQuery({ q: "https://github.com/" });
    } catch (e) {
      err = e;
    }
    expect(err.details[0].message).toBe(
      "Could not extract a GitHub username from the input."
    );
  });
});
