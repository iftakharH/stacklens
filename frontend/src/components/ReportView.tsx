import { useMemo } from 'react';
import type { Report } from '../types';
import { languageColor } from '../lib/languages';
import LanguageBar from './LanguageBar';
import { Field, Gauge, Readout, Scale } from './ui';

type ReportViewProps = {
  /** The analyzed GitHub username (the report renders report.overview.username). */
  username: string;
  report: Report;
};

// The hireability engine's own boundaries (lib/report.js): <3 Beginner,
// <5 Developing, <7 Junior Ready, <8.5 Strong Junior, then Hireable. Only the
// thresholds are printed on the scale; the band that applies is named once, in
// the chip beneath it.
const BANDS = [
  { at: 3, label: 'Beginner' },
  { at: 5, label: 'Developing' },
  { at: 7, label: 'Junior Ready' },
  { at: 8.5, label: 'Strong Junior' },
];

/**
 * The reading. Set as a calibration readout on the same card as the landing
 * page: identity, then measured values on printed scales, then the spectrum,
 * then the repositories and the derived insights. Nothing is boxed.
 */
const ReportView: React.FC<ReportViewProps> = ({ report }) => {
  const overallLabel = useMemo(() => {
    const score = report.scores.overall;
    if (score >= 8) return 'Strong overall presence';
    if (score >= 6) return 'Solid with room to grow';
    if (score >= 4) return 'Developing profile';
    return 'Early-stage footprint';
  }, [report]);

  const totalStars =
    report.meta.total_stars ??
    report.highlights.reduce((sum, repo) => sum + repo.stars, 0);

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ---------------------------------------------------------------- */}
      <Field title="Smart Summary" meta="Rule-based · no model">
        <p className="max-w-[64ch] text-[15px] leading-[1.65] text-ink2 sm:text-[17px]">
          {report.summary}
        </p>
      </Field>

      {/* ----------------------------------------------------------------
          The subject, and the one number that summarises the reading.
      ---------------------------------------------------------------- */}
      <section className="border-t border-line-strong pt-5">
        <div className="flex flex-wrap items-start gap-x-7 gap-y-6">
          <img
            src={report.overview.avatar_url}
            alt={report.overview.username}
            className="h-20 w-20 shrink-0 border border-line-strong object-cover sm:h-24 sm:w-24"
          />

          <div className="min-w-0 flex-1 basis-[18rem]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <a
                href={report.overview.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="display-tight text-[clamp(1.15rem,2.4vw,1.6rem)] text-ink transition-colors hover:text-signal"
              >
                {report.overview.name || report.overview.username}
              </a>
              <span className="num text-[12px] text-muted">
                @{report.overview.username}
              </span>
            </div>

            {report.overview.bio && (
              <p className="mt-2.5 line-clamp-2 max-w-[62ch] text-[13px] leading-[1.6] text-muted sm:line-clamp-3">
                {report.overview.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              {report.overview.created_at && (
                <span className="rail-sm text-muted">
                  Member since{' '}
                  {new Date(report.overview.created_at).toLocaleDateString(
                    undefined,
                    { month: 'short', year: 'numeric' }
                  )}
                </span>
              )}
              <span className="rail-sm text-muted">
                {report.overview.public_repos} repos
              </span>
              <span className="rail-sm text-muted">
                {report.stack.language_distribution.length} languages
              </span>
            </div>

            <a
              href={report.overview.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm mt-5"
            >
              View GitHub profile
            </a>
          </div>

          <div className="w-full shrink-0 basis-[14rem] border-t border-line pt-4 sm:w-[14rem] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="rail text-muted">Overall score</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-[2.4rem] font-semibold leading-none text-ink">
                {report.scores.overall.toFixed(1)}
              </span>
              <span className="num text-[12px] text-muted">/ 10</span>
            </div>
            <p className="mt-2 text-[12px] text-muted">{overallLabel}</p>
            <div className="mt-4">
              <Scale
                value={report.scores.overall}
                label="Overall score"
                bands={BANDS}
                compact
              />
            </div>
            <div className="relative mt-1 h-3.5" aria-hidden="true">
              {BANDS.map((band) => (
                <span
                  key={band.at}
                  className="num absolute -translate-x-1/2 text-[10px] text-muted"
                  style={{ left: `${Math.min(band.at * 10, 96)}%` }}
                >
                  {band.at}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-3">
          <p className="rail-sm text-muted">Band thresholds · 0–10 score</p>
          <p className="inline-flex shrink-0 items-center gap-2 border border-signal px-2 py-1">
            <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />
            <span className="rail-sm text-ink">
              {report.scores.hireability}
            </span>
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          Headline counts, set as a graduated strip.
      ---------------------------------------------------------------- */}
      <section className="border-y border-line-strong py-4">
        <dl className="grid grid-cols-2 gap-y-5 sm:grid-cols-3 md:grid-cols-5">
          <div className="min-w-0 pr-4">
            <Readout label="Followers" value={report.overview.followers} />
          </div>
          <div className="min-w-0 border-l border-line pl-4 sm:border-r md:pl-5">
            <Readout label="Following" value={report.overview.following ?? '—'} />
          </div>
          <div className="min-w-0 pr-4 md:border-r md:border-line md:pl-5">
            <Readout label="Public repos" value={report.overview.public_repos} />
          </div>
          <div className="min-w-0 border-l border-line pl-4 md:border-r md:pl-5">
            <Readout label="Total stars" value={totalStars} />
          </div>
          <div className="col-span-2 min-w-0 border-t border-line pr-4 pt-4 sm:col-span-1 sm:border-t-0 sm:pt-0 md:pl-5">
            <Readout
              label="Account age"
              value={
                report.overview.account_age_years != null
                  ? `${report.overview.account_age_years}y`
                  : '—'
              }
            />
          </div>
        </dl>
      </section>

      {/* ----------------------------------------------------------------
          Two ledgers: the raw overview, and the three sub-scores.
      ---------------------------------------------------------------- */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        <Field title="Developer Overview" meta="Public fields">
          <dl className="ledger border-t border-line">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-muted">Followers</dt>
              <dd className="num text-[13px] text-ink">{report.overview.followers}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-muted">Following</dt>
              <dd className="num text-[13px] text-ink">
                {report.overview.following ?? '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-muted">Public repos</dt>
              <dd className="num text-[13px] text-ink">
                {report.overview.public_repos}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-muted">Account age</dt>
              <dd className="num text-[13px] text-ink">
                {report.overview.account_age_years != null
                  ? `${report.overview.account_age_years} years`
                  : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-muted">Last activity</dt>
              <dd className="num text-[13px] text-ink">
                {report.overview.last_activity_days != null
                  ? `${report.overview.last_activity_days} days ago`
                  : '—'}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[13px] text-muted">Languages</dt>
              <dd className="num text-[13px] text-ink">
                {report.stack.language_distribution.length}
              </dd>
            </div>
          </dl>
        </Field>

        <Field title="Developer Score" meta="0 – 10">
          <div className="space-y-5 border-t border-line pt-4">
            <Gauge label="Activity" score={report.scores.activity} />
            <Gauge label="Stack diversity" score={report.scores.stackDiversity} />
            <Gauge label="Project quality" score={report.scores.projectQuality} />
          </div>
        </Field>
      </div>

      {/* ----------------------------------------------------------------
          The spectrum, then the repositories.
      ---------------------------------------------------------------- */}
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10">
        <Field title="Stack Analysis" meta="By repository size">
          <div className="border-t border-line pt-4">
            <div className="flex flex-wrap gap-2">
              {report.stack.primary_language && (
                <span className="inline-flex items-center gap-2 border border-line-strong px-2.5 py-1">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5"
                    style={{
                      backgroundColor: languageColor(report.stack.primary_language),
                    }}
                  />
                  <span className="text-[12px] font-medium text-ink">
                    Primary: {report.stack.primary_language}
                  </span>
                </span>
              )}
              {report.stack.secondary_language && (
                <span className="inline-flex items-center gap-2 border border-line px-2.5 py-1">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5"
                    style={{
                      backgroundColor: languageColor(report.stack.secondary_language),
                    }}
                  />
                  <span className="text-[12px] font-medium text-muted">
                    Secondary: {report.stack.secondary_language}
                  </span>
                </span>
              )}
            </div>

            {report.stack.language_distribution.length === 0 ? (
              <p className="mt-4 text-[13px] text-muted">No language data yet.</p>
            ) : (
              <div className="mt-5">
                <LanguageBar
                  items={report.stack.language_distribution}
                  height={26}
                  legendLayout="scale"
                />
              </div>
            )}
          </div>
        </Field>

        <Field title="Repository Highlights" meta="Top 5 by stars">
          <div className="ledger border-t border-line">
            {report.highlights.length === 0 ? (
              <p className="py-3 text-[13px] text-muted">
                No public repositories yet.
              </p>
            ) : (
              report.highlights.map((repo) => (
                <a
                  key={repo.id}
                  href={repo.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block py-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-signal">
                      {repo.name}
                    </p>
                    <span className="num shrink-0 text-[11px] text-muted">
                      ★ {repo.stars}
                    </span>
                  </div>
                  {repo.description && (
                    <p className="mt-1 line-clamp-2 max-w-[52ch] text-[12px] leading-[1.55] text-muted">
                      {repo.description}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <span className="rail-sm text-muted">
                      {repo.language || 'Other'}
                    </span>
                    {repo.updated_at && (
                      <span className="rail-sm text-muted">
                        Updated {new Date(repo.updated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        </Field>
      </div>

      {/* ---------------------------------------------------------------- */}
      <Field title="Developer Insights" meta={`${report.insights.length} found`}>
        <ul className="ledger border-t border-line">
          {report.insights.length === 0 ? (
            <li className="flex gap-3 py-2.5 text-[13px] text-muted">
              <span
                aria-hidden="true"
                className="mt-2 h-1 w-3 shrink-0 bg-line-strong"
              />
              <span>
                No strong signals yet. More activity and varied repos unlock
                richer insights.
              </span>
            </li>
          ) : (
            report.insights.map((insight, idx) => (
              <li key={idx} className="flex gap-3 py-2.5 text-[13px] text-ink2">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1 w-3 shrink-0 bg-signal"
                />
                <span className="max-w-[70ch] leading-[1.6]">{insight}</span>
              </li>
            ))
          )}
        </ul>
      </Field>

      <p className="mt-8 border-t border-line pt-4 text-[11px] leading-[1.7] text-muted">
        Computed from public repositories · no model, no opinion
      </p>
    </div>
  );
};

export default ReportView;
