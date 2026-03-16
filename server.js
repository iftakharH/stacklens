const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const GH_BASE = 'https://api.github.com';

function extractUsernameFromUrl(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // If it's already a plain username
  if (!trimmed.includes('http') && !trimmed.includes('/')) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[0] || null;
  } catch {
    // Fallback: try simple split
    const parts = trimmed.split('/');
    return parts.filter(Boolean).pop() || null;
  }
}

function computeReport(user, repos) {
  const now = new Date();
  const createdAt = user.created_at ? new Date(user.created_at) : null;
  const updatedAt = user.updated_at ? new Date(user.updated_at) : null;
  const accountAgeYears = createdAt ? (now - createdAt) / (1000 * 60 * 60 * 24 * 365) : null;

  let lastPushed = null;
  for (const repo of repos) {
    if (repo.pushed_at) {
      const d = new Date(repo.pushed_at);
      if (!lastPushed || d > lastPushed) lastPushed = d;
    }
  }
  const lastActivityDays = lastPushed ? (now - lastPushed) / (1000 * 60 * 60 * 24) : null;

  // Language stats
  const languageCounts = {};
  repos.forEach((r) => {
    const lang = r.language || 'Other';
    languageCounts[lang] = (languageCounts[lang] || 0) + 1;
  });
  const languageEntries = Object.entries(languageCounts).sort((a, b) => b[1] - a[1]);
  const primaryLanguage = languageEntries[0]?.[0] || null;
  const secondaryLanguage = languageEntries[1]?.[0] || null;
  const totalLangRepos = languageEntries.reduce((sum, [, count]) => sum + count, 0) || 1;
  const languageDistribution = languageEntries.map(([lang, count]) => ({
    language: lang,
    count,
    percentage: +(count / totalLangRepos * 100).toFixed(1),
  }));

  // Repo highlights
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

  // Simple rule-based scores
  const repoCount = repos.length;
  const followerCount = user.followers || 0;

  let activityScore = 5;
  if (lastActivityDays == null) {
    activityScore = 3;
  } else if (lastActivityDays < 30) {
    activityScore = 9;
  } else if (lastActivityDays < 90) {
    activityScore = 7;
  } else if (lastActivityDays < 180) {
    activityScore = 5;
  } else {
    activityScore = 3;
  }

  const distinctLangs = languageEntries.length;
  let stackDiversityScore = 5;
  if (distinctLangs >= 5) stackDiversityScore = 9;
  else if (distinctLangs >= 3) stackDiversityScore = 7;
  else if (distinctLangs >= 2) stackDiversityScore = 5;
  else stackDiversityScore = 3;

  let projectQualityScore = 4;
  if (repoCount > 15 && followerCount > 20) projectQualityScore = 9;
  else if (repoCount > 10 && followerCount > 10) projectQualityScore = 7;
  else if (repoCount > 5) projectQualityScore = 6;

  const overallScore = +(((activityScore + stackDiversityScore + projectQualityScore) / 3) / 2).toFixed(1);

  // Insights
  const insights = [];
  if (repoCount < 5) {
    insights.push('Build more public projects to showcase your skills and give recruiters more signal.');
  }
  if (lastActivityDays != null && lastActivityDays > 90) {
    insights.push('Your GitHub activity has been quiet recently — consider refreshing key repositories or starting a new one.');
  }
  if (distinctLangs <= 1 && repoCount >= 3) {
    insights.push('Most of your work is in a single language — exploring another stack could broaden your opportunities.');
  }
  const reposWithDescription = repos.filter((r) => !!r.description).length;
  if (repoCount > 0 && reposWithDescription / repoCount < 0.5) {
    insights.push('Many repositories have no description — adding concise documentation makes your work easier to evaluate.');
  }

  return {
    overview: {
      avatar_url: user.avatar_url,
      username: user.login,
      name: user.name,
      followers: user.followers,
      public_repos: user.public_repos,
      html_url: user.html_url,
      account_age_years: accountAgeYears != null ? +accountAgeYears.toFixed(1) : null,
      last_activity_days: lastActivityDays != null ? Math.round(lastActivityDays) : null,
      created_at: user.created_at,
      updated_at: user.updated_at,
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
      follower_count: followerCount,
    },
  };
}

app.get('/api/analyze', async (req, res) => {
  const input = req.query.q;
  const username = extractUsernameFromUrl(typeof input === 'string' ? input : '');

  if (!username) {
    return res.status(400).json({ error: 'Invalid GitHub profile URL or username.' });
  }

  try {
    const userResp = await axios.get(`${GH_BASE}/users/${username}`, {
      headers: { 'User-Agent': 'StackLens' },
    });
    const reposResp = await axios.get(`${GH_BASE}/users/${username}/repos`, {
      headers: { 'User-Agent': 'StackLens' },
      params: { per_page: 100, sort: 'updated' },
    });

    const report = computeReport(userResp.data, reposResp.data || []);
    res.json({ username, report });
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: 'GitHub user not found.' });
    }
    console.error('GitHub API error', err.response?.status, err.message);
    res.status(500).json({ error: 'Failed to analyze profile. Please try again later.' });
  }
});

app.listen(PORT, () => {
  console.log(`StackLens backend running on http://localhost:${PORT}`);
});

