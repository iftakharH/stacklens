function computeReport(user, repos, now = new Date()) {
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
  // Repo.language can be misleading if a profile has many small CSS/HTML repos.
  // To stabilize primary/secondary detection, weight languages by repo "size".
  const languageWeights = {};
  repos.forEach((r) => {
    const lang = r.language || "Other";
    const weight = Math.max(1, Number(r.size) || 1); // `size` is in KB
    languageWeights[lang] = (languageWeights[lang] || 0) + weight;
  });

  const languageEntries = Object.entries(languageWeights).sort(
    (a, b) => b[1] - a[1]
  );

  const primaryLanguage = languageEntries[0]?.[0] || null;
  const secondaryLanguage = languageEntries[1]?.[0] || null;

  const totalLangWeight =
    languageEntries.reduce((sum, [, w]) => sum + w, 0) || 1;

  const languageDistribution = languageEntries.map(([lang, w]) => ({
    language: lang,
    count: Math.round(w),
    percentage: +((w / totalLangWeight) * 100).toFixed(1),
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

  // ---------- Activity Score (0–10) ----------
  // Spec:
  // <7 days = 10, <30 = 8, <90 = 6, <180 = 4, <365 = 2, else = 0
  let activityScore = 0;
  if (lastActivityDays == null) {
    activityScore = 0;
  } else if (lastActivityDays < 7) activityScore = 10;
  else if (lastActivityDays < 30) activityScore = 8;
  else if (lastActivityDays < 90) activityScore = 6;
  else if (lastActivityDays < 180) activityScore = 4;
  else if (lastActivityDays < 365) activityScore = 2;
  else activityScore = 0;

  // ---------- Stack Diversity ----------
  const stackDiversityScore = Math.min(10, distinctLangs * 2);

  // ---------- Project Quality (0–10) ----------
  // Based on repo count, stars, and description ratio (simple & honest).
  const descRatio = repoCount === 0 ? 0 : reposWithDescription / repoCount;

  // Repo count: 0–5 points
  let repoPts = 0;
  if (repoCount >= 20) repoPts = 5;
  else if (repoCount >= 10) repoPts = 4;
  else if (repoCount >= 5) repoPts = 3;
  else if (repoCount >= 2) repoPts = 2;
  else if (repoCount >= 1) repoPts = 1;

  // Stars: 0–3 points (visibility signal)
  let starPts = 0;
  if (totalStars >= 100) starPts = 3;
  else if (totalStars >= 25) starPts = 2;
  else if (totalStars >= 5) starPts = 1;

  // Descriptions: 0–2 points (documentation signal)
  let docPts = 0;
  if (descRatio >= 0.8) docPts = 2;
  else if (descRatio >= 0.5) docPts = 1;

  const projectQualityScore = Math.min(10, repoPts + starPts + docPts);

  // ---------- Overall Score (weighted, 0–10, 1 decimal) ----------
  // EXACT formula required:
  // overallScore = (A*0.25) + (S*0.25) + (Q*0.5)
  // Round only once at the end.
  const overallScoreRaw =
    activityScore * 0.25 +
    stackDiversityScore * 0.25 +
    projectQualityScore * 0.5;
  const overallScore = Number(overallScoreRaw.toFixed(1));

  // ---------- Hireability label ----------
  let hireability = "Hireable";
  if (overallScore < 3) hireability = "Beginner";
  else if (overallScore < 5) hireability = "Developing";
  else if (overallScore < 7) hireability = "Junior Ready";
  else if (overallScore < 8.5) hireability = "Strong Junior";

  // ---------- AI-like summary (rule-based, 2–3 lines) ----------
  const stackFocus =
    primaryLanguage === "JavaScript" || primaryLanguage === "TypeScript"
      ? "JavaScript-focused"
      : primaryLanguage
        ? `${primaryLanguage}-focused`
        : "multi-language";

  const activityLine =
    lastActivityDays == null
      ? "Activity signal is limited (no recent push data found)."
      : lastActivityDays < 30
        ? "Actively pushing code with recent updates."
        : lastActivityDays < 90
          ? "Shows recent activity with periodic updates."
          : "Low recent activity — would benefit from more consistent contributions.";

  const improvementBits = [];
  if (repoCount < 5) improvementBits.push("more real-world projects");
  if (descRatio < 0.5) improvementBits.push("better project documentation");
  if (totalStars < 5) improvementBits.push("more visibility (stars)");

  const improvementLine =
    improvementBits.length > 0
      ? `Opportunity: ${improvementBits.join(", ")}.`
      : "Profile is well-rounded with good public signals.";

  const summary = [
    `Developer with a ${stackFocus} public portfolio (${repoCount} repos, ${distinctLangs} language(s)).`,
    activityLine,
    improvementLine,
  ].slice(0, 3).join(" ");

  // ---------- Insights ----------
  const insights = [];
  if (activityScore >= 8) insights.push("Strong activity — actively pushing code.");
  else if (activityScore <= 2)
    insights.push("Low activity — consider pushing code more consistently.");

  if (stackDiversityScore >= 8) insights.push("Good tech stack diversity.");
  else if (stackDiversityScore <= 4)
    insights.push("Narrow stack — exploring another tech could help.");

  if (descRatio < 0.5) insights.push("Projects lack documentation — many repos are missing descriptions.");
  if (totalStars < 5) insights.push("Low visibility — few stars across repositories.");
  if (repoCount < 5) insights.push("Small portfolio — add more public projects for stronger signal.");

  // Cap to 5, avoid repetition
  const cappedInsights =
    insights.length > 0
      ? insights.slice(0, 5)
      : [
          "Balanced signals — no major red flags in public activity, stack, or documentation.",
        ];

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
      hireability,
    },
    summary,
    insights: cappedInsights,
    meta: {
      repo_count: repoCount,
      total_stars: totalStars,
      follower_count: user.followers || 0,
    },
  };
}

module.exports = { computeReport };
