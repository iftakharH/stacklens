export type LanguageBucket = {
  language: string;
  count: number;
  percentage: number;
};

export type RepoHighlight = {
  id: number;
  name: string;
  description: string | null;
  stars: number;
  html_url: string;
  language: string | null;
  updated_at?: string;
};

export type Scores = {
  activity: number;
  stackDiversity: number;
  projectQuality: number;
  overall: number;
  hireability: string;
};

export type Overview = {
  avatar_url: string;
  username: string;
  name: string | null;
  bio: string | null;
  followers: number;
  following?: number;
  public_repos: number;
  html_url: string;
  account_age_years: number | null;
  last_activity_days: number | null;
  created_at?: string;
  updated_at?: string;
};

export type StackSummary = {
  primary_language: string | null;
  secondary_language: string | null;
  language_distribution: LanguageBucket[];
};

export type Report = {
  overview: Overview;
  stack: StackSummary;
  highlights: RepoHighlight[];
  scores: Scores;
  summary: string;
  insights: string[];
  meta: {
    repo_count: number;
    follower_count: number;
    total_stars?: number;
  };
};

export type Candidate = {
  id: string;
  github_username: string;
  note: string | null;
  created_at: string;
};

export type HistoryItem = {
  id: string;
  github_username: string;
  created_at: string;
  overall: number | null;
  hireability: string | null;
};

export type StoredReport = {
  username: string;
  report: Report;
  created_at: string;
};

export type AnalyzeData = {
  username: string;
  report: Report;
  report_id: string | null;
};

export type ShareLinkData = {
  token: string;
  path: string;
  id: string;
};
