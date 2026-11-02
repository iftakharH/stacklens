const axios = require("axios");
const { ApiError, ERROR_CODES } = require("./errors");

const GITHUB_API_BASE = () => process.env.GITHUB_API_BASE || "https://api.github.com";
const PER_PAGE = 100;
const MAX_PAGES = 10;
// Hard per-request ceiling: a stalled GitHub connection must never hold the
// serverless function until the platform timeout (maxDuration) kills it.
const GITHUB_TIMEOUT_MS = 15_000;

function githubHeaders() {
  const headers = { "User-Agent": "StackLens" };
  const token = process.env.GITHUB_TOKEN || "";
  if (token) headers.Authorization = `token ${token}`;
  return headers;
}

function retryAfterSeconds(headers) {
  const retryAfter = Number(headers?.["retry-after"]);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter;

  const resetAt = Number(headers?.["x-ratelimit-reset"]);
  if (Number.isFinite(resetAt) && resetAt > 0) {
    return Math.max(1, resetAt - Math.floor(Date.now() / 1000));
  }

  return 60;
}

function mapGithubError(err, resource) {
  const status = err?.response?.status;

  if (status === 404) {
    return new ApiError(ERROR_CODES.NOT_FOUND, `GitHub ${resource} not found.`, {
      status: 404,
    });
  }

  if (status === 429) {
    // Secondary/abuse rate limits come back as 429 with Retry-After; treat
    // them like the primary limit, not like a generic upstream failure.
    const seconds = retryAfterSeconds(err.response.headers);
    return new ApiError(
      ERROR_CODES.RATE_LIMITED,
      `GitHub API rate limit hit. Try again in ${seconds} seconds.`,
      { status: 429, retryable: true, retryAfter: seconds }
    );
  }

  if (status === 403) {
    const remaining = err.response.headers?.["x-ratelimit-remaining"];
    if (String(remaining) === "0") {
      const seconds = retryAfterSeconds(err.response.headers);
      return new ApiError(
        ERROR_CODES.RATE_LIMITED,
        `GitHub API rate limit hit. Try again in ${seconds} seconds (or configure a GitHub token on the backend).`,
        { status: 429, retryable: true, retryAfter: seconds }
      );
    }
    return new ApiError(
      ERROR_CODES.UPSTREAM_ERROR,
      "GitHub rejected the request (403).",
      { status: 502, retryable: true }
    );
  }

  if (status !== undefined && status >= 500) {
    return new ApiError(
      ERROR_CODES.UPSTREAM_ERROR,
      "GitHub API is currently unavailable.",
      { status: 502, retryable: true }
    );
  }

  const message = err?.code === "ECONNABORTED"
    ? "GitHub API request timed out."
    : "Could not reach the GitHub API.";
  return new ApiError(ERROR_CODES.UPSTREAM_ERROR, message, {
    status: 502,
    retryable: true,
  });
}

function nextLink(headers) {
  const link = headers?.link || "";
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

async function fetchUser(username) {
  const url = `${GITHUB_API_BASE()}/users/${encodeURIComponent(username)}`;
  try {
    const resp = await axios.get(url, {
      headers: githubHeaders(),
      timeout: GITHUB_TIMEOUT_MS,
    });
    return resp.data;
  } catch (err) {
    throw mapGithubError(err, "user");
  }
}

async function fetchAllRepos(username) {
  const base = GITHUB_API_BASE();
  const headers = githubHeaders();
  const all = [];
  let url = `${base}/users/${encodeURIComponent(username)}/repos?per_page=${PER_PAGE}&sort=updated`;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let resp;
    try {
      resp = await axios.get(url, { headers, timeout: GITHUB_TIMEOUT_MS });
    } catch (err) {
      throw mapGithubError(err, "repositories");
    }
    if (Array.isArray(resp.data)) all.push(...resp.data);
    const next = nextLink(resp.headers);
    if (!next || (Array.isArray(resp.data) && resp.data.length === 0)) break;
    if (page === MAX_PAGES) {
      // Profiles with more than 1,000 repos are truncated; say so in the logs
      // instead of silently undercounting stars, languages, and activity.
      console.warn(
        `fetchAllRepos: ${username} has more than ${MAX_PAGES * PER_PAGE} repos — analysis uses the ${MAX_PAGES * PER_PAGE} most-recently-updated only.`
      );
    }
    url = next;
  }

  return all;
}

module.exports = { githubHeaders, fetchUser, fetchAllRepos, GITHUB_API_BASE };
