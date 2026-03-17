const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const GH_BASE = "https://api.github.com";

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

function computeReport(user, repos) {
  const now = new Date();

  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const accountAgeYears = createdAt
    ? (now - createdAt) / (1000 * 60 * 60 * 24 * 365)
    : null;

  // ---------- Activity ----------
  let lastPushed = null;

  for (const repo of repos) {
    if (repo.pushed_at) {
      const d = new Date(repo.pushed_at);
      if (!lastPushed || d > lastPushed) lastPushed = d;
    }
  }

  const lastActivityDays = lastPushed
    ? (now - lastPushed) / (1000 * 60 * 60 * 24)
    : null;

  // ---------- Language stats ----------
  const languageCounts = {};

  repos.forEach((r) => {
    const lang = r.language || "Other";
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  });

  const languageEntries = Object.entries(languageCounts).sort(
    (a, b) => b[1] - a[1]
  );

  const primaryLanguage = languageEntries[0]?.[0] || null;
  const secondaryLanguage = languageEntries[1]?.[0] || null;

  const totalLangRepos =
    languageEntries.reduce((sum, [, count]) => sum + count, 0) || 1;

  const languageDistribution = languageEntries.map(([lang, count]) => ({
    language: lang,
    count,
    percentage: +((count / totalLangRepos) * 100).toFixed(1),
  }));

  // ---------- Repo highlights ----------
  const topRepos = [...repos]
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      stars: r.stargazers_count || 0,
      html_url: r.html_url,
      language: r.language,
      updated_at: r.pushed_at || r.updated_at,
    }));

  // ---------- Core stats ----------
  const repoCount = repos.length;

  const distinctLangs = languageEntries.length;

  const totalStars = repos.reduce(
    (sum, r) => sum + (r.stargazers_count || 0),
    0
  );

  const reposWithDescription = repos.filter((r) => !!r.description).length;

  // ---------- Activity Score ----------
  let activityScore = 0;

  if (lastActivityDays == null) {
    activityScore = repoCount === 0 ? 0 : 1;
  } else if (lastActivityDays < 7) activityScore = 10;
  else if (lastActivityDays < 30) activityScore = 8;
  else if (lastActivityDays < 90) activityScore = 6;
  else if (lastActivityDays < 180) activityScore = 4;
  else if (lastActivityDays < 365) activityScore = 2;
  else activityScore = 0;

  // ---------- Stack Diversity ----------
  const stackDiversityScore = Math.min(10, distinctLangs * 2);

  // ---------- Project Quality ----------
  let projectQualityScore = 0;

  if (repoCount >= 15) projectQualityScore += 4;
  else if (repoCount >= 8) projectQualityScore += 3;
  else if (repoCount >= 3) projectQualityScore += 2;
  else if (repoCount >= 1) projectQualityScore += 1;

  // Avoid division by zero
  const descRatio =
    repoCount === 0 ? 0 : reposWithDescription / repoCount;

  if (descRatio > 0.7) projectQualityScore += 3;
  else if (descRatio > 0.4) projectQualityScore += 2;
  else if (descRatio > 0.2) projectQualityScore += 1;

  if (totalStars >= 50) projectQualityScore += 3;
  else if (totalStars >= 10) projectQualityScore += 2;
  else if (totalStars >= 3) projectQualityScore += 1;

  projectQualityScore = Math.min(projectQualityScore, 10);

  // ---------- Overall Score ----------
  // Keep overall consistent with the three displayed sub-scores.
  // Simple & honest: plain average (0–10), one decimal.
  const overallScore = +(
    (activityScore + stackDiversityScore + projectQualityScore) / 3
  ).toFixed(1);

  // ---------- Insights ----------
  const insights = [];

  const lastActivityText =
    lastActivityDays != null
      ? `Last push was ${Math.round(lastActivityDays)} days ago.`
      : "No recent push data.";

  insights.push(
    `${repoCount} public repos, ${distinctLangs} language(s). ${lastActivityText}`
  );

  if (repoCount < 3 && repoCount > 0) {
    insights.push(
      "Few public repos — adding more helps recruiters see your work."
    );
  }

  if (lastActivityDays != null && lastActivityDays > 180) {
    insights.push(
      "No push in 6+ months — consider updating a repo."
    );
  }

  if (distinctLangs >= 2 && distinctLangs <= 4) {
    insights.push("Uses a few languages — good variety.");
  }

  if (distinctLangs === 1 && repoCount >= 2) {
    insights.push(
      "All repos use one language — trying another stack could broaden appeal."
    );
  }

  if (repoCount > 0 && reposWithDescription < Math.ceil(repoCount / 2)) {
    insights.push(
      "Less than half of repos have descriptions — adding READMEs helps."
    );
  }

  if (totalStars > 0) {
    insights.push(`Total stars across repos: ${totalStars}.`);
  }

  return {
    overview: {
      avatar_url: user.avatar_url,
      username: user.login,
      name: user.name,
      bio: user.bio || null,
      followers: user.followers,
      following: user.following,
      public_repos: user.public_repos,
      html_url: user.html_url,
      account_age_years:
        accountAgeYears != null ? +accountAgeYears.toFixed(1) : null,
      last_activity_days:
        lastActivityDays != null ? Math.round(lastActivityDays) : null,
      created_at: user.created_at,
    },
    stack: {
      primary_language: primaryLanguage,
      secondary_language: secondaryLanguage,
      language_distribution: languageDistribution,
    },
    highlights: topRepos,
    scores: {
      activity: activityScore,
      stackDiversity: stackDiversityScore,
      projectQuality: projectQualityScore,
      overall: overallScore,
    },
    insights,
    meta: {
      repo_count: repoCount,
      total_stars: totalStars,
      follower_count: user.followers || 0,
    },
  };
}

app.get("/api/analyze", async (req, res) => {
  const input = req.query.q;

  const username = extractUsernameFromUrl(
    typeof input === "string" ? input : ""
  );

  if (!username) {
    return res
      .status(400)
      .json({ error: "Invalid GitHub profile URL or username." });
  }

  try {
    const userResp = await axios.get(`${GH_BASE}/users/${username}`, {
      headers: { "User-Agent": "StackLens" },
    });

    const reposResp = await axios.get(`${GH_BASE}/users/${username}/repos`, {
      headers: { "User-Agent": "StackLens" },
      params: { per_page: 100, sort: "updated" },
    });

    const report = computeReport(userResp.data, reposResp.data || []);

    res.json({ username, report });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: "GitHub user not found." });
    }

    console.error("GitHub API error", err.response?.status, err.message);

    res.status(500).json({
      error: "Failed to analyze profile. Please try again later.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`StackLens backend running on http://localhost:${PORT}`);
});