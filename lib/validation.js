const { z } = require("zod");
const { ApiError, ERROR_CODES } = require("./errors");

function extractUsernameFromUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();

  if (!trimmed) return null;

  // Already a username
  if (!trimmed.includes("http") && !trimmed.includes("/")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0] || null;
  } catch {
    const parts = trimmed.split("/");
    return parts.filter(Boolean).pop() || null;
  }
}

const analyzeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Enter a GitHub username or profile URL.")
    .max(200, "Input must be 200 characters or fewer."),
});

const githubUsernameSchema = z
  .string({ error: "github_username is required." })
  .trim()
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/,
    "GitHub usernames are 1-39 characters: letters, digits, single hyphens."
  );

const candidateBodySchema = z.object({
  github_username: githubUsernameSchema,
  note: z.string().trim().max(500, "Note must be 500 characters or fewer.").optional(),
});

const shareBodySchema = z.object({
  report_id: z.uuid({ error: "report_id must be a UUID." }),
  expires_in_days: z
    .number({ error: "expires_in_days must be a number of days." })
    .int("expires_in_days must be a whole number of days.")
    .min(1, "expires_in_days must be at least 1.")
    .max(30, "expires_in_days can be at most 30.")
    .optional(),
});

const idParamSchema = z.uuid("Invalid id.");

const historyQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int("limit must be a whole number.")
    .min(1, "limit must be at least 1.")
    .max(100, "limit can be at most 100.")
    .default(20),
  offset: z.coerce
    .number()
    .int("offset must be a whole number.")
    .min(0, "offset cannot be negative.")
    .default(0),
});

function validationError(message, details) {
  return new ApiError(ERROR_CODES.VALIDATION, message, {
    status: 400,
    details,
  });
}

function parseAnalyzeQuery(query) {
  if (query == null || typeof query.q !== "string") {
    throw validationError("Query parameter 'q' is required.", [
      { path: "q", message: "Expected a GitHub username or profile URL string." },
    ]);
  }

  const parsed = analyzeQuerySchema.safeParse({ q: query.q });
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "q",
      message: issue.message,
    }));
    throw validationError("Invalid GitHub profile URL or username.", details);
  }

  const username = extractUsernameFromUrl(parsed.data.q);
  if (!username) {
    throw validationError("Invalid GitHub profile URL or username.", [
      { path: "q", message: "Could not extract a GitHub username from the input." },
    ]);
  }

  return { username };
}

function parseBody(schema, body, message) {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "body",
      message: issue.message,
    }));
    throw validationError(message, details);
  }
  return parsed.data;
}

function parseIdParam(value, label = "id") {
  const parsed = idParamSchema.safeParse(value ?? "");
  if (!parsed.success) {
    throw validationError(`Invalid ${label}.`, [
      { path: label, message: "Expected a UUID." },
    ]);
  }
  return parsed.data;
}

function parseQuery(schema, query, message) {
  const parsed = schema.safeParse(query ?? {});
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "query",
      message: issue.message,
    }));
    throw validationError(message, details);
  }
  return parsed.data;
}

module.exports = {
  analyzeQuerySchema,
  candidateBodySchema,
  extractUsernameFromUrl,
  historyQuerySchema,
  parseAnalyzeQuery,
  parseBody,
  parseIdParam,
  parseQuery,
  shareBodySchema,
};
