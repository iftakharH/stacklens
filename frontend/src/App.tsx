import { useCallback, useMemo, useState } from 'react';

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
  followers: number;
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
  };
};

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: { username: string; report: Report } };

const BACKEND_URL = 'http://localhost:4000/api/analyze';

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

const Card: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="glass-surface-light dark:glass-surface rounded-2xl p-5 sm:p-6 shadow-soft fade-in">
    {title && (
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900 dark:text-slate-100 uppercase">
          {title}
        </h2>
      </header>
    )}
    {children}
  </section>
);

const SkeletonPulse = () => (
  <div className="flex items-center gap-3 rounded-full bg-slate-900/60 px-4 py-2 text-sm text-slate-200 shadow-soft">
    <span className="h-3 w-3 animate-pulse rounded-full bg-primary-soft" />
    <span className="font-medium tracking-wide text-slate-100">
      Analyzing GitHub profile…
    </span>
  </div>
);

const ThemeToggle: React.FC<{ dark: boolean; onToggle: () => void }> = ({
  dark,
  onToggle,
}) => (
  <button
    onClick={onToggle}
    className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-200 shadow-soft transition hover:border-primary-soft/80 hover:text-primary-soft"
    aria-label="Toggle dark mode"
  >
    <span
      className={`h-4 w-4 rounded-full border border-slate-700/70 bg-slate-900 transition ${dark ? 'shadow-[0_0_0_1px_rgba(168,85,247,0.3)]' : ''}`}
    />
    <span>{dark ? 'Dark' : 'Light'} mode</span>
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

function App() {
  const [input, setInput] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });

  const handleAnalyze = useCallback(
    async (e: React.FormEvent) => {
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

  const overallLabel = useMemo(() => {
    if (state.status !== 'success') return '';
    const score = state.data.report.scores.overall;
    if (score >= 8) return 'Strong overall presence';
    if (score >= 6) return 'Solid with room to grow';
    if (score >= 4) return 'Developing profile';
    return 'Early-stage footprint';
  }, [state]);

  const rootClass = darkMode ? 'dark' : '';

  return (
    <div className={rootClass}>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-8 pt-6 sm:px-6 sm:pt-10 lg:px-10">
          <header className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-soft via-primary to-indigo-500 shadow-soft">
                <span className="text-lg font-black tracking-tight text-white">SL</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-slate-50 sm:text-xl">
                  StackLens
                </h1>
                <p className="text-xs text-slate-400 sm:text-sm">
                  See the developer behind the repositories.
                </p>
              </div>
            </div>
            <ThemeToggle dark={darkMode} onToggle={() => setDarkMode((v) => !v)} />
          </header>

          <main className="flex flex-1 flex-col gap-6 lg:flex-row">
            <section className="w-full lg:w-[40%]">
              <div className="glass-surface-light dark:glass-surface mb-4 rounded-2xl p-6 shadow-soft">
                <div className="mb-5 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-soft">
                    Profile Analyzer
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                    Drop a GitHub profile.
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Paste a GitHub URL or username. StackLens will compile a compact, recruiter friendly view of the developer behind the activity.
                  </p>
                </div>

                <form onSubmit={handleAnalyze} className="space-y-3">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                    GitHub profile URL
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="https://github.com/octocat"
                        className="w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-primary-soft focus:ring-2 focus:ring-primary-soft/40 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-50"
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary via-primary-soft to-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:translate-y-[1px] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={state.status === 'loading'}
                    >
                      {state.status === 'loading' ? 'Analyzing…' : 'Analyze Profile'}
                    </button>
                  </div>
                  {state.status === 'error' && (
                    <p className="text-xs text-rose-400">{state.message}</p>
                  )}
                  {state.status === 'idle' && (
                    <p className="text-xs text-slate-400">
                      No GitHub token required. Public data only.
                    </p>
                  )}
                </form>
              </div>

              <div className="flex items-center justify-between gap-3">
                {state.status === 'loading' ? (
                  <SkeletonPulse />
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Designed for quick technical screening and recruiter-friendly summaries.
                  </p>
                )}
              </div>
            </section>

            <section className="w-full space-y-4 lg:w-[60%]">
              {state.status === 'success' ? (
                <>
                  <Card>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <img
                          src={state.data.report.overview.avatar_url}
                          alt={state.data.report.overview.username}
                          className="h-14 w-14 rounded-2xl border border-slate-800/70 object-cover shadow-md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <a
                              href={state.data.report.overview.html_url}
                              target="_blank"
                              className="text-sm font-semibold tracking-tight text-slate-900 transition hover:text-primary-soft dark:text-slate-50"
                            >
                              {state.data.report.overview.name ||
                                state.data.report.overview.username}
                            </a>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              @{state.data.report.overview.username}
                            </span>
                          </div>
                          <p className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              Followers:{' '}
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {state.data.report.overview.followers}
                              </span>
                            </span>
                            <span>•</span>
                            <span>
                              Public repos:{' '}
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {state.data.report.overview.public_repos}
                              </span>
                            </span>
                            {state.data.report.overview.account_age_years != null && (
                              <>
                                <span>•</span>
                                <span>
                                  Account age:{' '}
                                  <span className="font-medium text-slate-800 dark:text-slate-100">
                                    {state.data.report.overview.account_age_years}y
                                  </span>
                                </span>
                              </>
                            )}
                            {state.data.report.overview.last_activity_days != null && (
                              <>
                                <span>•</span>
                                <span>
                                  Last activity:{' '}
                                  <span className="font-medium text-slate-800 dark:text-slate-100">
                                    {state.data.report.overview.last_activity_days} days ago
                                  </span>
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="ml-auto flex flex-col items-end gap-1 text-right">
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Overall score
                        </span>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className={`text-3xl font-semibold tabular-nums ${scoreColor(state.data.report.scores.overall * 2)}`}
                          >
                            {state.data.report.scores.overall.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-500">/ 10</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{overallLabel}</p>
                      </div>
                    </div>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card title="Developer Overview">
                      <dl className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                        <div>
                          <dt>Followers</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-100">
                            {state.data.report.overview.followers}
                          </dd>
                        </div>
                        <div>
                          <dt>Public repositories</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-100">
                            {state.data.report.overview.public_repos}
                          </dd>
                        </div>
                        <div>
                          <dt>Account age</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-100">
                            {state.data.report.overview.account_age_years != null
                              ? `${state.data.report.overview.account_age_years} years`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>Last activity</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-100">
                            {state.data.report.overview.last_activity_days != null
                              ? `${state.data.report.overview.last_activity_days} days ago`
                              : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt>Total starred repos (top 5)</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-100">
                            {state.data.report.highlights.reduce(
                              (sum, r) => sum + r.stars,
                              0
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Language diversity</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-100">
                            {state.data.report.stack.language_distribution.length} languages
                          </dd>
                        </div>
                      </dl>
                    </Card>

                    <Card title="Developer Score">
                      <div className="space-y-3">
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

                  <div className="grid gap-4 lg:grid-cols-3">
                    <Card title="Stack Analysis">
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          {state.data.report.stack.primary_language && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary-soft">
                              Primary:{' '}
                              <span className="text-slate-50">
                                {state.data.report.stack.primary_language}
                              </span>
                            </span>
                          )}
                          {state.data.report.stack.secondary_language && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                              Secondary:{' '}
                              <span className="text-slate-50">
                                {state.data.report.stack.secondary_language}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="mt-2 space-y-2">
                          {state.data.report.stack.language_distribution.length === 0 ? (
                            <p className="text-xs text-slate-400">
                              No language data available yet.
                            </p>
                          ) : (
                            <>
                              <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                                <div className="flex h-full w-full">
                                  {state.data.report.stack.language_distribution.map(
                                    (bucket, idx) => (
                                      <div
                                        key={bucket.language}
                                        style={{ width: `${bucket.percentage}%` }}
                                        className={`transition-all ${['bg-primary-soft/80', 'bg-emerald-400/80', 'bg-sky-400/80', 'bg-amber-400/80'][idx % 4]}`}
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                              <ul className="flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                                {state.data.report.stack.language_distribution.map(
                                  (bucket, idx) => (
                                    <li
                                      key={bucket.language}
                                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${chipColor(idx)}`}
                                    >
                                      <span>{bucket.language}</span>
                                      <span className="text-slate-400">
                                        {bucket.percentage}%
                                      </span>
                                    </li>
                                  )
                                )}
                              </ul>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>

                    <Card title="Repository Highlights">
                      <div className="space-y-3">
                        {state.data.report.highlights.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No public repositories to highlight yet.
                          </p>
                        ) : (
                          state.data.report.highlights.map((repo) => (
                            <a
                              key={repo.id}
                              href={repo.html_url}
                              target="_blank"
                              className="block rounded-xl border border-slate-800/70 bg-slate-900/50 px-3.5 py-2.5 text-xs transition hover:border-primary-soft/80 hover:bg-slate-900/80"
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-semibold text-slate-50">
                                  {repo.name}
                                </p>
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                                  ★ {repo.stars}
                                </span>
                              </div>
                              {repo.description && (
                                <p className="line-clamp-2 text-[11px] text-slate-400">
                                  {repo.description}
                                </p>
                              )}
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
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
                      <ul className="space-y-2 text-xs text-slate-300">
                        {state.data.report.insights.length === 0 ? (
                          <li className="text-slate-400">
                            No strong signals yet. More activity and varied repositories will
                            unlock richer insights.
                          </li>
                        ) : (
                          state.data.report.insights.map((insight, idx) => (
                            <li key={idx} className="flex gap-2">
                              <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-primary-soft" />
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
                  <div className="flex h-full flex-col justify-center gap-4 py-8 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary-soft">
                      Developer report
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-50">
                      Your next candidate, in one glance.
                    </h2>
                    <p className="mx-auto max-w-md text-sm text-slate-400">
                      Once you paste a GitHub profile, StackLens assembles a compact overview of
                      stack, activity, and signal so you can move from resume to conversation
                      faster.
                    </p>
                  </div>
                </Card>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

const ScoreRow: React.FC<{ label: string; score: number }> = ({ label, score }) => {
  const percentage = (score / 10) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-slate-200">{score.toFixed(1)} / 10</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-primary-soft via-primary to-emerald-400`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default App;

