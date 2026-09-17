import { useMemo } from 'react';
import type { Report } from '../types';
import { languageColor } from '../lib/languages';
import { Card, ScoreRow, StatCard } from './ui';

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
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">Smart Summary</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted sm:text-sm">
              {report.summary}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink">
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
              className="h-20 w-20 shrink-0 rounded-[6px] border border-line object-cover sm:h-24 sm:w-24"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={report.overview.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-semibold text-ink transition-colors hover:text-signal sm:text-lg"
                >
                  {report.overview.name || report.overview.username}
                </a>
                <span className="rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-[11px] text-muted">
                  @{report.overview.username}
                </span>
              </div>
              {report.overview.bio && (
                <p className="line-clamp-2 text-[13px] text-muted sm:line-clamp-3">
                  {report.overview.bio}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
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
                className="inline-flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-signal"
              >
                View GitHub profile
              </a>
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1 border-t border-line pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
            <span className="text-[11px] font-semibold text-muted">
              Overall score
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-bold tabular-nums text-ink sm:text-3xl">
                {report.scores.overall.toFixed(1)}
              </span>
              <span className="text-[13px] text-muted">/ 10</span>
            </div>
            <p className="text-[12px] text-muted">{overallLabel}</p>
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
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:gap-y-4">
            <div>
              <dt className="text-muted">Followers</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {report.overview.followers}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Following</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {report.overview.following ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Public repos</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {report.overview.public_repos}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Account age</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {report.overview.account_age_years != null
                  ? `${report.overview.account_age_years} years`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Last activity</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {report.overview.last_activity_days != null
                  ? `${report.overview.last_activity_days} days ago`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Languages</dt>
              <dd className="mt-0.5 font-semibold text-ink">
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

      <div className="grid items-start gap-3 sm:grid-cols-2 sm:gap-4">
        <Card title="Stack Analysis">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {report.stack.primary_language && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{
                      backgroundColor: languageColor(report.stack.primary_language),
                    }}
                  />
                  Primary: {report.stack.primary_language}
                </span>
              )}
              {report.stack.secondary_language && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[12px] font-medium text-muted">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{
                      backgroundColor: languageColor(report.stack.secondary_language),
                    }}
                  />
                  Secondary: {report.stack.secondary_language}
                </span>
              )}
            </div>
            {report.stack.language_distribution.length === 0 ? (
              <p className="text-[13px] text-muted">No language data yet.</p>
            ) : (
              <>
                <div className="h-2.5 overflow-hidden rounded-full bg-line">
                  <div className="flex h-full">
                    {report.stack.language_distribution.map((bucket) => (
                      <div
                        key={bucket.language}
                        style={{
                          width: `${bucket.percentage}%`,
                          backgroundColor: languageColor(bucket.language),
                        }}
                        className="shrink-0 transition-all"
                      />
                    ))}
                  </div>
                </div>
                <ul className="flex flex-wrap gap-1.5 text-[11px]">
                  {report.stack.language_distribution.map((bucket) => (
                    <li
                      key={bucket.language}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-0.5 text-muted"
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-[2px]"
                        style={{ backgroundColor: languageColor(bucket.language) }}
                      />
                      <span className="text-ink">{bucket.language}</span>
                      <span className="font-mono tabular-nums text-muted">
                        {bucket.percentage}%
                      </span>
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
              <p className="text-[13px] text-muted">No public repositories yet.</p>
            ) : (
              report.highlights.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 rounded-[6px] border border-line bg-paper p-3 transition-colors hover:border-signal"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-semibold text-ink">
                      {repo.name}
                    </p>
                    <span className="shrink-0 rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">
                      ★ {repo.stars}
                    </span>
                  </div>
                  {repo.description && (
                    <p className="line-clamp-2 text-[12px] text-muted">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-muted">
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

        <Card title="Developer Insights" className="sm:col-span-2">
          <ul className="space-y-2 text-[13px] text-muted">
            {report.insights.length === 0 ? (
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-line" />
                No strong signals yet. More activity and varied repos unlock richer insights.
              </li>
            ) : (
              report.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
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
