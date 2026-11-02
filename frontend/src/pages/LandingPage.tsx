import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '../api/auth';
import LanguageBar from '../components/LanguageBar';
import SignInMethods from '../components/SignInMethods';
import { Registration } from '../components/ui';
import { useTheme } from '../lib/useTheme';

// Real public data, read from github.com/torvalds. These are the values the
// analyzer returned for that profile — not a mock-up — so the specimen on the
// landing page shows what the product actually produces.
const SPECIMEN = {
  login: 'torvalds',
  repositories: 12,
  stars: 262280,
  followers: 323661,
  languages: [
    { language: 'C', percentage: 97.5 },
    { language: 'C++', percentage: 2.3 },
    { language: 'OpenSCAD', percentage: 0.2 },
  ],
};

const MEASURES = [
  {
    unit: 'share',
    name: 'Language mix',
    reading:
      'The share of each language across the profile’s repositories, weighted by repository size.',
  },
  {
    unit: 'days',
    name: 'Activity',
    reading: 'Days since the most recent push, across all repositories.',
  },
  {
    unit: 'count',
    name: 'Stack diversity',
    reading: 'How many distinct languages appear in the profile.',
  },
  {
    unit: 'ratio',
    name: 'Project quality',
    reading:
      'Repository count, stars, and how many repositories carry a description.',
  },
  {
    unit: 'score 0–10',
    name: 'Overall score',
    reading:
      'Activity and stack diversity at 25% each, project quality at 50%, on a 0–10 scale.',
  },
  {
    unit: 'band',
    name: 'Hireability read',
    reading:
      'A plain-language band, from Beginner to Hireable, for the same score.',
  },
];

const KEPT = [
  {
    name: 'Saved candidates',
    reading: 'Keep a shortlist, with a note on each person.',
  },
  {
    name: 'History',
    reading: 'Every profile you analyze while signed in is stored and reopenable.',
  },
  {
    name: 'Share links',
    reading: 'Send one report to a colleague as a link they can open.',
  },
];

const fmt = new Intl.NumberFormat('en-US');

/**
 * The registration ring. The hero is inscribed inside it: this is a calibration
 * card, and the headline sits in the card's target, not on a template's left
 * column.
 */
const RegistrationRing: React.FC = () => {
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 * Math.PI) / 180;
    const long = i % 5 === 0;
    const outer = 199;
    const inner = outer - (long ? 13 : 6);
    return {
      key: i,
      x1: 200 + Math.cos(angle) * outer,
      y1: 200 + Math.sin(angle) * outer,
      x2: 200 + Math.cos(angle) * inner,
      y2: 200 + Math.sin(angle) * inner,
      long,
    };
  });

  return (
    <svg
      viewBox="0 0 400 400"
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-[42%] h-[min(92vw,600px)] w-[min(92vw,600px)] -translate-x-1/2 -translate-y-1/2 text-line-strong"
      fill="none"
      stroke="currentColor"
    >
      <circle cx="200" cy="200" r="199" strokeWidth="1" />
      <circle cx="200" cy="200" r="150" strokeWidth="1" opacity="0.62" />
      <circle cx="200" cy="200" r="112" strokeWidth="1" opacity="0.34" />
      {ticks.map((t) => (
        <line
          key={t.key}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          strokeWidth="1"
          opacity={t.long ? '0.9' : '0.45'}
        />
      ))}
    </svg>
  );
};

const ThemeButton: React.FC<{ dark: boolean; onToggle: () => void }> = ({
  dark,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-muted transition-colors hover:border-signal hover:text-ink"
  >
    {dark ? (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0-9a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 8 2Zm0 10.5a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1a.75.75 0 0 1 .75-.75ZM14 8a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1 0-1.5h1A.75.75 0 0 1 14 8ZM4.5 8a.75.75 0 0 1-.75.75h-1a.75.75 0 0 1 0-1.5h1A.75.75 0 0 1 4.5 8Zm8.24-4.24a.75.75 0 0 1 0 1.06l-.7.71a.75.75 0 1 1-1.07-1.06l.71-.71a.75.75 0 0 1 1.06 0ZM5.03 10.97a.75.75 0 0 1 0 1.06l-.71.71a.75.75 0 0 1-1.06-1.06l.7-.71a.75.75 0 0 1 1.07 0Zm8.24 1.06a.75.75 0 0 1-1.06 1.06l-.71-.7a.75.75 0 1 1 1.06-1.07l.71.71ZM5.03 5.03a.75.75 0 0 1-1.07 1.06l-.7-.71A.75.75 0 0 1 4.32 4.3l.71.71Z" />
      </svg>
    ) : (
      <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
        <path d="M6.2 2.1a6 6 0 1 0 7.7 7.7 5 5 0 0 1-7.7-7.7Z" />
      </svg>
    )}
  </button>
);

const SignInPanel: React.FC = () => {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="plate relative p-5 sm:p-6">
        <Registration />
        <p className="rail text-muted">Account</p>
        <p className="mt-2 text-[13px] text-muted">Checking your session…</p>
      </div>
    );
  }

  if (session?.user) {
    const user = session.user;
    return (
      <div className="plate relative p-5 sm:p-6">
        <Registration />
        <p className="rail text-muted">Account · signed in</p>
        <div className="mt-4 flex items-center gap-3 border-b border-line pb-4">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-10 w-10 border border-line-strong object-cover"
            />
          ) : (
            <span className="num flex h-10 w-10 items-center justify-center border border-line-strong text-[13px] text-ink">
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              {user.name || user.email}
            </p>
            <p className="rail-sm mt-1 text-muted">Reading on record</p>
          </div>
        </div>
        <Link to="/analyze" className="btn btn-primary mt-5 h-11 w-full">
          Open the analyzer
        </Link>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut();
          }}
          className="mt-3 w-full text-center text-[13px] text-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="plate relative p-5 sm:p-6">
      <Registration />
      <p className="rail text-muted">Account · optional</p>
      <p className="display-tight mt-3 text-[1.05rem] text-ink">Sign in</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        Use GitHub, or have a one-time link emailed to you.
      </p>
      <div className="mt-5">
        <SignInMethods idPrefix="landing" />
      </div>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { dark, toggle } = useTheme();
  const { data: session, isPending } = authClient.useSession();
  const signedIn = !isPending && Boolean(session?.user);

  // Failed sign-ins come back here as ?authError=1&error=<code> (see
  // lib/auth.js onAPIError + SignInMethods errorCallbackURL).
  const authFailed =
    searchParams.has('error') || searchParams.get('authError') === '1';

  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');

  const handleAnalyze = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) {
      setInputError('Enter a GitHub username or profile URL.');
      return;
    }
    setInputError('');
    navigate(`/analyze?q=${encodeURIComponent(value)}`);
  };

  return (
    <div className="ground min-h-screen">
      <div className="mx-auto w-full max-w-[1400px] px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
        <div className="frame acquire relative flex min-h-[calc(100vh-1.5rem)] flex-col overflow-hidden">
          <Registration />

          {/* Card edge code: what this card is, stamped at the margin. */}
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2 sm:px-7 lg:px-14">
            <span className="rail-sm truncate text-muted">
              StackLens · developer reading
            </span>
            <span className="rail-sm hidden truncate text-muted sm:block">
              Public GitHub data · no account required
            </span>
          </div>

          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-7 lg:px-14">
            <Link to="/" className="flex min-w-0 items-center gap-2.5">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-signal"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="8.5" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                <path
                  d="M12 0.5v4M12 19.5v4M0.5 12h4M19.5 12h4"
                  strokeWidth="1.5"
                />
              </svg>
              <span className="display-tight text-[0.9375rem] text-ink">
                StackLens
              </span>
              <span aria-hidden="true" className="hidden h-4 w-px bg-line-strong sm:block" />
              <span className="hidden text-[12px] text-muted md:inline">
                See the developer behind the repositories.
              </span>
            </Link>

            <nav className="flex flex-wrap items-center gap-2 text-[13px] sm:gap-4">
              <a
                href="#measures"
                className="rail hidden text-muted transition-colors hover:text-ink sm:inline"
              >
                What it measures
              </a>
              {signedIn ? (
                <>
                  <Link
                    to="/analyze"
                    className="rail text-ink underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-signal"
                  >
                    Open analyzer
                  </Link>
                  {session?.user?.image && (
                    <img
                      src={session.user.image}
                      alt=""
                      className="h-7 w-7 border border-line-strong object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void authClient.signOut();
                    }}
                    className="rail text-muted transition-colors hover:text-ink"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <a
                  href="#account"
                  className="rail text-ink underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-signal"
                >
                  Sign in
                </a>
              )}
              <ThemeButton dark={dark} onToggle={toggle} />
            </nav>
          </header>

          <div aria-hidden="true" className="px-4 sm:px-7 lg:px-14">
            <div className="ticks-x" />
          </div>

          <main className="flex-1">
            {authFailed && (
              <div
                role="status"
                className="mx-4 mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border border-line bg-plate px-4 py-3 sm:mx-7 lg:mx-14"
              >
                <span className="rail text-danger">Sign-in failed</span>
                <span className="text-[13px] text-ink">
                  Nothing was changed.
                </span>
                <a
                  href="#account"
                  className="text-[13px] text-ink underline decoration-signal underline-offset-4"
                >
                  Try again
                </a>
              </div>
            )}

            {/* ---------------------------------------------------------------
                Acquisition. The headline is inscribed in the registration
                ring; the control plate sits on the card's lower band; the
                specimen is the card's own colour bar along the bottom edge.
            ---------------------------------------------------------------- */}
            <section className="relative isolate overflow-hidden px-4 pb-0 pt-14 sm:px-7 sm:pt-20 lg:px-14 lg:pt-24">
              <div
                aria-hidden="true"
                className="ticks-y absolute inset-y-6 left-0 -z-10 hidden lg:block"
              />
              <div
                aria-hidden="true"
                className="ticks-y absolute inset-y-6 right-0 -z-10 hidden lg:block"
              />
              <div className="pointer-events-none absolute inset-0 -z-10 opacity-70">
                <RegistrationRing />
              </div>

              <div className="mx-auto max-w-[46rem] text-center">
                <h1
                  className="display rise mx-auto max-w-[24ch] text-[clamp(2.15rem,5.6vw,4.1rem)] text-ink"
                  style={{ animationDelay: '80ms' }}
                >
                  Read the work, not the resume.
                </h1>
                <p
                  className="rise mx-auto mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-ink2 sm:text-base"
                  style={{ animationDelay: '180ms' }}
                >
                  Paste a GitHub profile. StackLens returns one page — language
                  mix, activity, project quality and a hireability signal —
                  computed from public repositories.
                </p>
              </div>

              <div
                className="rise mx-auto mt-9 max-w-[38rem] sm:mt-11"
                style={{ animationDelay: '260ms' }}
              >
                <form onSubmit={handleAnalyze}>
                  <label
                    htmlFor="hero-profile"
                    className="rail block text-muted"
                  >
                    GitHub profile URL or username
                  </label>
                  <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="hero-profile"
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="github.com/torvalds"
                      className="field-input h-12 flex-1 sm:h-[3.25rem]"
                      aria-invalid={inputError ? true : undefined}
                      aria-describedby={inputError ? 'hero-profile-error' : 'hero-profile-hint'}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary h-12 shrink-0 px-6 sm:h-[3.25rem]"
                    >
                      Analyze profile
                    </button>
                  </div>
                  {inputError ? (
                    <p
                      id="hero-profile-error"
                      className="mt-3 border-l border-danger pl-3 text-[13px] text-danger"
                      role="alert"
                    >
                      {inputError}
                    </p>
                  ) : (
                    <p id="hero-profile-hint" className="rail-sm mt-3 text-muted">
                      No account needed · public data only
                    </p>
                  )}
                </form>
              </div>

              <div className="mx-auto mt-10 flex max-w-[38rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-3">
                <span className="rail-sm text-muted">
                  Instrument · public repositories
                </span>
                <span className="rail-sm text-muted">
                  Deterministic · same reading every time
                </span>
              </div>
            </section>

            {/* The specimen: the card's spectrum strip and its printed scale. */}
            <section className="mt-14 border-t border-line-strong sm:mt-16">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-7 lg:px-14">
                <span className="rail text-muted">
                  Specimen · read from public GitHub data
                </span>
                <a
                  href={`https://github.com/${SPECIMEN.login}`}
                  target="_blank"
                  rel="noreferrer"
                  className="num text-[12px] text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-signal"
                >
                  github.com/{SPECIMEN.login}
                </a>
              </div>

              <div className="px-4 sm:px-7 lg:px-14">
                <LanguageBar
                  items={SPECIMEN.languages}
                  height={30}
                  legend={false}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 border-t border-line sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <dl className="grid grid-cols-3 border-b border-line sm:border-b-0 sm:border-r">
                  <div className="px-4 py-4 sm:px-7 lg:px-14">
                    <dt className="rail-sm text-muted">Repos</dt>
                    <dd className="num mt-2 text-[clamp(1rem,1.9vw,1.3rem)] font-semibold text-ink">
                      {fmt.format(SPECIMEN.repositories)}
                    </dd>
                  </div>
                  <div className="border-l border-line px-4 py-4 sm:px-5">
                    <dt className="rail-sm text-muted">Stars</dt>
                    <dd className="num mt-2 text-[clamp(1rem,1.9vw,1.3rem)] font-semibold text-ink">
                      {fmt.format(SPECIMEN.stars)}
                    </dd>
                  </div>
                  <div className="border-l border-line px-4 py-4 sm:px-5">
                    <dt className="rail-sm text-muted">Followers</dt>
                    <dd className="num mt-2 text-[clamp(1rem,1.9vw,1.3rem)] font-semibold text-ink">
                      {fmt.format(SPECIMEN.followers)}
                    </dd>
                  </div>
                </dl>

                <div className="px-4 py-4 sm:px-7">
                  <ul className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    {SPECIMEN.languages.map((item) => (
                      <li key={item.language} className="flex items-baseline gap-2">
                        <span className="text-[13px] font-medium text-ink">
                          {item.language}
                        </span>
                        <span className="num text-[11px] text-muted">
                          {item.percentage}%
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[12px] leading-relaxed text-muted">
                    Read from public GitHub data. Another developer reads
                    completely differently — that is the point.
                  </p>
                </div>
              </div>
            </section>

            {/* ---------------------------------------------------------------
                What the report measures. A graduated ledger: unit, name, and
                the reading each one produces.
            ---------------------------------------------------------------- */}
            <section id="measures" className="border-t border-line-strong px-4 py-14 sm:px-7 sm:py-16 lg:px-14">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-14">
                <div className="lg:sticky lg:top-8 lg:self-start">
                  <h2 className="display-tight text-[clamp(1.5rem,3vw,2.25rem)] text-ink">
                    What the report measures
                  </h2>
                  <p className="mt-4 max-w-[42ch] text-[15px] leading-[1.65] text-muted">
                    Every number is computed from public repositories, and the
                    same numbers are shown to the person being read. Same
                    profile, same result, every time.
                  </p>
                  <div aria-hidden="true" className="ticks-x-subtle mt-6 max-w-[12rem]" />
                </div>

                <dl className="ledger border-t border-line-strong">
                  {MEASURES.map((measure) => (
                    <div
                      key={measure.name}
                      className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:py-5"
                    >
                      <dt className="num pt-1 text-[11px] uppercase tracking-[0.1em] text-signal">
                        {measure.unit}
                      </dt>
                      <dd className="min-w-0">
                        <span className="block text-[16px] font-semibold text-ink">
                          {measure.name}
                        </span>
                        <span className="mt-1 block max-w-[58ch] text-[14px] leading-[1.6] text-muted">
                          {measure.reading}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            {/* ---------------------------------------------------------------
                Account. What an account keeps, and the sign-in plate.
            ---------------------------------------------------------------- */}
            <section id="account" className="border-t border-line-strong px-4 py-14 sm:px-7 sm:py-16 lg:px-14">
              <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-14">
                <div>
                  <h2 className="display-tight max-w-[24ch] text-[clamp(1.5rem,3vw,2.25rem)] text-ink">
                    An account keeps the work you have already done.
                  </h2>

                  <dl className="ledger mt-8 border-t border-line-strong">
                    {KEPT.map((item) => (
                      <div key={item.name} className="py-4">
                        <dt className="text-[15px] font-semibold text-ink">
                          {item.name}
                        </dt>
                        <dd className="mt-1 max-w-[62ch] text-[14px] leading-[1.6] text-muted">
                          {item.reading}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <p className="rail-sm mt-6 text-muted">
                    Analyzing never requires an account
                  </p>
                </div>

                <SignInPanel />
              </div>
            </section>
          </main>

          <footer className="border-t border-line-strong">
            <div aria-hidden="true" className="px-4 pt-3 sm:px-7 lg:px-14">
              <div className="ticks-x-subtle" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-7 lg:px-14">
              <p className="rail-sm text-muted">
                Public GitHub data, read the same way every time
              </p>
              <p className="rail-sm text-muted">Not affiliated with GitHub</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
