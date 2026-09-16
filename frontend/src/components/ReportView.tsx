import { useMemo } from 'react';
import type { Report } from '../types';
import { Card, ScoreRow, StatCard } from './ui';

const scoreColor = (score: number) => {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-300';
  return 'text-rose-400';
};

const hireabilityBadge = (label: string) => {
  switch (label) {
    case 'Hireable':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/30';
    case 'Strong Junior':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/30';
    case 'Junior Ready':
      return 'bg-primary/15 text-primary-dark dark:text-primary-soft border-primary/30';
    case 'Developing':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-500/20';
  }
};

const chipColor = (idx: number) => {
  const palette = [
    'bg-primary/20 text-primary-dark dark:text-primary-soft',
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    'bg-amber-500/10 text-amber-800 dark:text-amber-300',
  ];
  return palette[idx % palette.length];
};

type ReportViewProps = {
  /** The analyzed GitHub username (the report renders report.overview.username). */
  username: string;
  report: Report;
};

// Renders a full computed report. Extracted verbatim from the original
// App.tsx analyze result so the analyze page and shared links look identical.
const ReportView: React.FC<ReportViewProps> = ({ report }) => {
  const overallLabel = useMemo(() => {
    const score = report.scores.overall;
    if (score >= 8) return 'Strong overall presence';
    if (score >= 6) return 'Solid with room to grow';
    if (score >= 4) return 'Developing profile';
    return 'Early-stage footprint';
  }, [report]);

  return (
    <>
      {/* AI-like Summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-white/80 to-white/70 dark:from-primary-soft/10 dark:via-slate-800/80 dark:to-slate-800/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary-soft">
              Smart Summary
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {report.summary}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${hireabilityBadge(
                report.scores.hireability
              )}`}
            >
              {report.scores.hireability}
            </span>
          </div>
        </div>
      </Card>

      {/* Hero profile card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start md:gap-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            <img
              src={report.overview.avatar_url}
              alt={report.overview.username}
              className="h-20 w-20 shrink-0 rounded-2xl border-2 border-slate-200 object-cover shadow-md dark:border-slate-600 sm:h-24 sm:w-24"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={report.overview.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-slate-800 hover:text-primary dark:text-slate-100 dark:hover:text-primary-soft sm:text-lg"
                >
                  {report.overview.name || report.overview.username}
                </a>
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  @{report.overview.username}
                </span>
              </div>
              {report.overview.bio && (
                <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400 sm:line-clamp-3">
                  {report.overview.bio}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                {report.overview.created_at && (
                  <span>
                    Member since{' '}
                    {new Date(report.overview.created_at).toLocaleDateString(
                      undefined,
                      { month: 'short', year: 'numeric' }
                    )}
                  </span>
                )}
                <span>{report.overview.public_repos} repos</span>
                <span>
                  {report.stack.language_distribution.length} languages
                </span>
              </div>
              <a
                href={report.overview.html_url}
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
                className={`text-2xl font-bold tabular-nums sm:text-3xl ${scoreColor(report.scores.overall)}`}
              >
                {report.scores.overall.toFixed(1)}
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
        <StatCard label="Followers" value={report.overview.followers} />
        <StatCard label="Following" value={report.overview.following ?? '—'} />
        <StatCard label="Public repos" value={report.overview.public_repos} />
        <StatCard
          label="Total stars"
          value={
            report.meta.total_stars ??
            report.highlights.reduce((s, r) => s + r.stars, 0)
          }
        />
        <StatCard
          label="Account age"
          value={
            report.overview.account_age_years != null
              ? `${report.overview.account_age_years}y`
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
                {report.overview.followers}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Following</dt>
              <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                {report.overview.following ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Public repos</dt>
              <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                {report.overview.public_repos}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Account age</dt>
              <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                {report.overview.account_age_years != null
                  ? `${report.overview.account_age_years} years`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Last activity</dt>
              <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                {report.overview.last_activity_days != null
                  ? `${report.overview.last_activity_days} days ago`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Languages</dt>
              <dd className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                {report.stack.language_distribution.length}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Developer Score">
          <div className="space-y-3 sm:space-y-4">
            <ScoreRow label="Activity" score={report.scores.activity} />
            <ScoreRow label="Stack diversity" score={report.scores.stackDiversity} />
            <ScoreRow label="Project quality" score={report.scores.projectQuality} />
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card title="Stack Analysis">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {report.stack.primary_language && (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary-dark dark:bg-primary-soft/20 dark:text-primary-soft">
                  Primary: {report.stack.primary_language}
                </span>
              )}
              {report.stack.secondary_language && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                  Secondary: {report.stack.secondary_language}
                </span>
              )}
            </div>
            {report.stack.language_distribution.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No language data yet.
              </p>
            ) : (
              <>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="flex h-full">
                    {report.stack.language_distribution.map((bucket, idx) => (
                      <div
                        key={bucket.language}
                        style={{ width: `${bucket.percentage}%` }}
                        className={`shrink-0 transition-all ${['bg-primary-soft', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-500'][idx % 4]}`}
                      />
                    ))}
                  </div>
                </div>
                <ul className="flex flex-wrap gap-1.5 text-[11px]">
                  {report.stack.language_distribution.map((bucket, idx) => (
                    <li
                      key={bucket.language}
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${chipColor(idx)}`}
                    >
                      <span>{bucket.language}</span>
                      <span className="opacity-80">{bucket.percentage}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>

        <Card title="Repository Highlights">
          <div className="space-y-2 sm:space-y-2.5">
            {report.highlights.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No public repositories yet.
              </p>
            ) : (
              report.highlights.map((repo) => (
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
            {report.insights.length === 0 ? (
              <li className="flex gap-2 text-slate-500 dark:text-slate-400">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-500" />
                No strong signals yet. More activity and varied repos unlock richer insights.
              </li>
            ) : (
              report.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-soft" />
                  <span>{insight}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </>
  );
};

export default ReportView;
