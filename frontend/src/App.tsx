import { useCallback, useEffect, useMemo, useState } from 'react';

type LanguageBucket = {
  language: string;
  count: number;
  percentage: number;
};

type RepoHighlight = {
  id: number;
  name: string;
  description: string | null;
  stars: number;
  html_url: string;
  language: string | null;
  updated_at?: string;
};

type Scores = {
  activity: number;
  stackDiversity: number;
  projectQuality: number;
  overall: number;
};

type Overview = {
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

type StackSummary = {
  primary_language: string | null;
  secondary_language: string | null;
  language_distribution: LanguageBucket[];
};

type Report = {
  overview: Overview;
  stack: StackSummary;
  highlights: RepoHighlight[];
  scores: Scores;
  insights: string[];
  meta: {
    repo_count: number;
    follower_count: number;
    total_stars?: number;
  };
};

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: { username: string; report: Report } };

// Call a same-origin API route. In dev, Vite proxies `/api` to localhost backend.
// In prod (Vercel), configure a rewrite from `/api/*` to your Render backend.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ??
  (import.meta.env.DEV ? 'http://localhost:4000/api/analyze' : '/api/analyze');


  const scoreColor = (score: number) => {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-300';
  return 'text-rose-400';
};

const chipColor = (idx: number) => {
  const palette = [
    'bg-primary/20 text-primary-soft',
    'bg-emerald-500/10 text-emerald-300',
    'bg-sky-500/10 text-sky-300',
    'bg-amber-500/10 text-amber-300',
  ];
  return palette[idx % palette.length];
};

const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = '',
}) => (
  <section
    className={`rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm transition dark:border-slate-700/80 dark:bg-slate-800/80 sm:p-5 md:p-6 ${className} fade-in`}
  >
    {title && (
      <header className="mb-3 sm:mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:text-sm">
          {title}
        </h2>
      </header>
    )}
    {children}
  </section>
);

const SkeletonPulse = () => (
  <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
    <span className="h-3 w-3 animate-pulse rounded-full bg-primary-soft" />
    <span className="font-medium text-slate-600 dark:text-slate-300">
      Analyzing GitHub profile…
    </span>
  </div>
);

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-800/80">
    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100 sm:text-xl">
      {value}
    </p>
  </div>
);

const ThemeToggle: React.FC<{ dark: boolean; onToggle: () => void }> = ({
  dark,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm transition hover:border-primary-soft hover:text-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-primary-soft dark:hover:text-primary-soft"
    aria-label="Toggle dark mode"
  >
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 transition ${
        dark
          ? 'border-primary-soft bg-primary-soft shadow-[0_0_8px_rgba(168,85,247,0.5)]'
          : 'border-slate-400 bg-amber-200'
      }`}
    />
    <span>{dark ? 'Dark' : 'Light'}</span>
  </button>
);

const extractUsernameClient = (raw: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('http') && !trimmed.includes('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    const parts = trimmed.split('/').filter(Boolean);
    return parts.pop() || null;
  }
};

const THEME_KEY = 'stacklens-theme';

function App() {
  const [input, setInput] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [darkMode]);

  const handleAnalyze = useCallback(
    async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      const username = extractUsernameClient(input);
      if (!username) {
        setState({ status: 'error', message: 'Please enter a valid GitHub URL or username.' });
        return;
      }
      setState({ status: 'loading' });
      try {
        const res = await fetch(`${BACKEND_URL}?q=${encodeURIComponent(input)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to analyze profile.');
        }
        const data = (await res.json()) as { username: string; report: Report };
        setState({ status: 'success', data });
      } catch (err: any) {
        setState({
          status: 'error',
          message: err?.message || 'Something went wrong while analyzing.',
        });
      }
    },
    [input]
  );

  const computedOverall = useMemo(() => {
    if (state.status !== 'success') return null;
    const { activity, stackDiversity, projectQuality } = state.data.report.scores;
    return +((activity + stackDiversity + projectQuality) / 3).toFixed(1);
  }, [state]);

  const overallLabel = useMemo(() => {
    if (state.status !== 'success') return '';
    const score = computedOverall ?? state.data.report.scores.overall;
    if (score >= 8) return 'Strong overall presence';
    if (score >= 6) return 'Solid with room to grow';
    if (score >= 4) return 'Developing profile';
    return 'Early-stage footprint';
  }, [computedOverall, state]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-3 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-6 md:px-6 lg:px-8 lg:pb-10 xl:px-10">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6 md:mb-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-soft shadow-md sm:h-10 sm:w-10 sm:rounded-2xl">
              <span className="text-base font-black text-white sm:text-lg">SL</span>
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold tracking-tight text-slate-800 dark:text-slate-50 sm:text-lg md:text-xl">
                StackLens
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                See the developer behind the repositories.
              </p>
            </div>
          </div>
          <ThemeToggle dark={darkMode} onToggle={() => setDarkMode((v) => !v)} />
        </header>

        <main className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6 xl:gap-8">
          <section className="w-full shrink-0 lg:max-w-[380px] xl:max-w-[420px]">
            <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/90 sm:p-5 md:p-6">
              <div className="mb-4 space-y-1.5 sm:mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-soft sm:text-xs">
                  Profile Analyzer
                </p>
                <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-50 sm:text-2xl">
                  Drop a GitHub profile
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                  Paste a URL or username for a recruiter-friendly developer snapshot.
                </p>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-3">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  GitHub profile URL or username
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="https://github.com/username"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-soft px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={state.status === 'loading'}
                  >
                    {state.status === 'loading' ? 'Analyzing…' : 'Analyze Profile'}
                  </button>
                </div>
                {state.status === 'error' && (
                  <p className="text-xs text-rose-500 dark:text-rose-400">{state.message}</p>
                )}
                {state.status === 'idle' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Public data only · no token required.
                  </p>
                )}
              </form>
            </div>

            <div className="mt-3 sm:mt-4">
              {state.status === 'loading' ? (
                <SkeletonPulse />
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quick technical screening for recruiters.
                </p>
              )}
            </div>
          </section>

            <section className="min-w-0 flex-1 space-y-3 sm:space-y-4">
              {state.status === 'success' ? (
                <>
                  {/* Hero profile card */}
                  <Card className="overflow-hidden">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start md:gap-5">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                        <img
                          src={state.data.report.overview.avatar_url}
                          alt={state.data.report.overview.username}
                          className="h-20 w-20 shrink-0 rounded-2xl border-2 border-slate-200 object-cover shadow-md dark:border-slate-600 sm:h-24 sm:w-24"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={state.data.report.overview.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-base font-semibold text-slate-800 hover:text-primary dark:text-slate-100 dark:hover:text-primary-soft sm:text-lg"
                            >
                              {state.data.report.overview.name ||
                                state.data.report.overview.username}
                            </a>
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              @{state.data.report.overview.username}
                            </span>
                          </div>
                          {state.data.report.overview.bio && (
                            <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400 sm:line-clamp-3">
                              {state.data.report.overview.bio}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            {state.data.report.overview.created_at && (
                              <span>
                                Member since{' '}
                                {new Date(state.data.report.overview.created_at).toLocaleDateString(
                                  undefined,
                                  { month: 'short', year: 'numeric' }
                                )}
                              </span>
                            )}
                            <span>{state.data.report.overview.public_repos} repos</span>
                            <span>
                              {state.data.report.stack.language_distribution.length} languages
                            </span>
                          </div>
                          <a
                            href={state.data.report.overview.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 dark:border-primary-soft/40 dark:bg-primary-soft/10 dark:text-primary-soft dark:hover:bg-primary-soft/20"
                          >
                            View GitHub profile →
                          </a>
                        </div>
                      </div>
                      <div className="ml-auto flex shrink-0 flex-col items-end gap-1 border-t border-slate-200 pt-4 dark:border-slate-600 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Overall score
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={`text-2xl font-bold tabular-nums sm:text-3xl ${scoreColor(computedOverall ?? state.data.report.scores.overall)}`}
                          >
                            {(computedOverall ?? state.data.report.scores.overall).toFixed(1)}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400">/ 10</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {overallLabel}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 sm:gap-3">
                    <StatCard
                      label="Followers"
                      value={state.data.report.overview.followers}
                    />
                    <StatCard
                      label="Following"
                      value={state.data.report.overview.following || '—'}
                    />
                    <StatCard
                      label="Public repos"
                      value={state.data.report.overview.public_repos}
                    />
                    <StatCard
                      label="Total stars"
                      value={
                        state.data.report.meta.total_stars ??
                        state.data.report.highlights.reduce((s, r) => s + r.stars, 0)
                      }
                    />
                    <StatCard
                      label="Account age"
                      value={
                        state.data.report.overview.account_age_years != null
                          ? `${state.data.report.overview.account_age_years}y`
                          : '—'
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                    <Card title="Developer Overview">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:gap-y-4">
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">Followers</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                            {state.data.report.overview.followers}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">Following</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                            {state.data.report.overview.following ?? '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">Public repos</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                            {state.data.report.overview.public_repos}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">Account age</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                            {state.data.report.overview.account_age_years != null
                              ? `${state.data.report.overview.account_age_years} years`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">Last activity</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                            {state.data.report.overview.last_activity_days != null
                              ? `${state.data.report.overview.last_activity_days} days ago`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">Languages</dt>
                          <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                            {state.data.report.stack.language_distribution.length}
                          </dd>
                        </div>
                      </dl>
                    </Card>

                    <Card title="Developer Score">
                      <div className="space-y-3 sm:space-y-4">
                        <ScoreRow
                          label="Activity"
                          score={state.data.report.scores.activity}
                        />
                        <ScoreRow
                          label="Stack diversity"
                          score={state.data.report.scores.stackDiversity}
                        />
                        <ScoreRow
                          label="Project quality"
                          score={state.data.report.scores.projectQuality}
                        />
                      </div>
                    </Card>
                  </div>

                  <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
                    <Card title="Stack Analysis">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {state.data.report.stack.primary_language && (
                            <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary-soft/20 dark:text-primary-soft">
                              Primary: {state.data.report.stack.primary_language}
                            </span>
                          )}
                          {state.data.report.stack.secondary_language && (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                              Secondary: {state.data.report.stack.secondary_language}
                            </span>
                          )}
                        </div>
                        {state.data.report.stack.language_distribution.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No language data yet.
                          </p>
                        ) : (
                          <>
                            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div className="flex h-full">
                                {state.data.report.stack.language_distribution.map(
                                  (bucket, idx) => (
                                    <div
                                      key={bucket.language}
                                      style={{ width: `${bucket.percentage}%` }}
                                      className={`shrink-0 transition-all ${['bg-primary-soft', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-500'][idx % 4]}`}
                                    />
                                  )
                                )}
                              </div>
                            </div>
                            <ul className="flex flex-wrap gap-1.5 text-[11px]">
                              {state.data.report.stack.language_distribution.map(
                                (bucket, idx) => (
                                  <li
                                    key={bucket.language}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${chipColor(idx)}`}
                                  >
                                    <span>{bucket.language}</span>
                                    <span className="opacity-80">{bucket.percentage}%</span>
                                  </li>
                                )
                              )}
                            </ul>
                          </>
                        )}
                      </div>
                    </Card>

                    <Card title="Repository Highlights">
                      <div className="space-y-2 sm:space-y-2.5">
                        {state.data.report.highlights.length === 0 ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            No public repositories yet.
                          </p>
                        ) : (
                          state.data.report.highlights.map((repo) => (
                            <a
                              key={repo.id}
                              href={repo.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-3 transition hover:border-primary/40 hover:bg-slate-100/80 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-primary-soft/40 dark:hover:bg-slate-800/80"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {repo.name}
                                </p>
                                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                                  ★ {repo.stars}
                                </span>
                              </div>
                              {repo.description && (
                                <p className="line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">
                                  {repo.description}
                                </p>
                              )}
                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                <span>{repo.language || 'Other'}</span>
                                {repo.updated_at && (
                                  <span>
                                    Updated{' '}
                                    {new Date(repo.updated_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </a>
                          ))
                        )}
                      </div>
                    </Card>

                    <Card title="Developer Insights">
                      <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {state.data.report.insights.length === 0 ? (
                          <li className="flex gap-2 text-slate-500 dark:text-slate-400">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-500" />
                            No strong signals yet. More activity and varied repos unlock richer insights.
                          </li>
                        ) : (
                          state.data.report.insights.map((insight, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft" />
                              <span>{insight}</span>
                            </li>
                          ))
                        )}
                      </ul>
                    </Card>
                  </div>

                  {/* Developer TODO:
                   - Scoring logic: Refine `computeReport` on the backend to weight signals like commit frequency, issue participation, PR history, and star growth over time rather than simple thresholds.
                   - AI analysis: Add an `/api/ai-summary` endpoint that calls an LLM to turn the raw metrics + repo metadata into a narrative profile and role-fit suggestions.
                   - Recruiter features: Persist reports, add bookmarking, export to PDF, and support side‑by‑side comparisons of multiple candidates. */}
                </>
              ) : (
                <Card>
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center sm:py-12">
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary-soft">
                      Developer report
                    </p>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 sm:text-xl">
                      Your next candidate, in one glance.
                    </h2>
                    <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
                      Paste a GitHub profile to see a compact overview of stack, activity, and
                      signal — so you can move from resume to conversation faster.
                    </p>
                  </div>
                </Card>
              )}
            </section>
          </main>
        </div>
      </div>
  );
}

const ScoreRow: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const percentage = (score / 10) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-slate-800 dark:text-slate-200">
          {score.toFixed(1)} / 10
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-soft to-emerald-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default App;

