import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '../api/auth';
import LanguageBar from '../components/LanguageBar';
import SignInMethods from '../components/SignInMethods';
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
    name: 'Language mix',
    reading:
      'The share of each language across the profile’s repositories, weighted by repository size.',
  },
  {
    name: 'Activity',
    reading: 'Days since the most recent push, across all repositories.',
  },
  {
    name: 'Stack diversity',
    reading: 'How many distinct languages appear in the profile.',
  },
  {
    name: 'Project quality',
    reading:
      'Repository count, stars, and how many repositories carry a description.',
  },
  {
    name: 'Overall score',
    reading:
      'Activity and stack diversity at 25% each, project quality at 50%, on a 0–10 scale.',
  },
  {
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

const ThemeButton: React.FC<{ dark: boolean; onToggle: () => void }> = ({
  dark,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-line text-muted transition-colors hover:border-signal hover:text-ink"
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
      <div className="self-start rounded-[6px] border border-line bg-panel p-5 sm:p-6">
        <p className="text-[13px] text-muted">Checking your session…</p>
      </div>
    );
  }

  if (session?.user) {
    const user = session.user;
    return (
      <div className="self-start rounded-[6px] border border-line bg-panel p-5 sm:p-6">
        <div className="flex items-center gap-3">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="h-9 w-9 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line font-mono text-[13px] text-ink">
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">
              {user.name || user.email}
            </p>
            <p className="text-[12px] text-muted">Signed in</p>
          </div>
        </div>
        <Link
          to="/analyze"
          className="mt-5 flex h-11 w-full items-center justify-center rounded-[6px] bg-signal text-[14px] font-semibold text-signal-ink transition-opacity hover:opacity-90"
        >
          Open the analyzer
        </Link>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut();
          }}
          className="mt-3 w-full text-[13px] text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="self-start rounded-[6px] border border-line bg-panel p-5 sm:p-6">
      <p className="text-[14px] font-semibold text-ink">Sign in</p>
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
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="text-[15px] font-extrabold tracking-tight text-ink">
              StackLens
            </span>
            <span className="hidden text-[13px] text-muted md:inline">
              See the developer behind the repositories.
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-5 text-[13px]">
            <a
              href="#measures"
              className="hidden text-muted transition-colors hover:text-ink sm:inline"
            >
              What it measures
            </a>
            {signedIn ? (
              <>
                <Link
                  to="/analyze"
                  className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-signal"
                >
                  Open analyzer
                </Link>
                {session?.user?.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full border border-line object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    void authClient.signOut();
                  }}
                  className="text-muted transition-colors hover:text-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <a
                href="#account"
                className="text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-signal"
              >
                Sign in
              </a>
            )}
            <ThemeButton dark={dark} onToggle={toggle} />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 sm:px-8">
        {authFailed && (
          <div
            role="status"
            className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[6px] border border-line bg-panel px-4 py-3 text-[13px] text-ink"
          >
            <span>Sign-in didn&apos;t complete. Nothing was changed.</span>
            <a
              href="#account"
              className="underline decoration-line underline-offset-4 transition-colors hover:decoration-signal"
            >
              Try again
            </a>
          </div>
        )}
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_1px_minmax(0,0.85fr)] lg:gap-14">
            <div>
              <h1 className="display max-w-[15ch] text-balance text-[clamp(2.25rem,4.6vw,3.25rem)] text-ink">
                Read the work, not the resume.
              </h1>
              <p className="mt-6 max-w-[58ch] text-[1.0625rem] leading-[1.6] text-muted">
                Paste a GitHub profile. StackLens returns one page — language
                mix, activity, project quality and a hireability signal —
                computed from public repositories.
              </p>

              <form onSubmit={handleAnalyze} className="mt-8 max-w-[560px]">
                <label
                  htmlFor="hero-profile"
                  className="block text-[13px] font-medium text-ink"
                >
                  GitHub profile URL or username
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="hero-profile"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="github.com/torvalds"
                    className="h-12 min-w-0 flex-1 rounded-[6px] border border-line bg-panel px-4 text-[15px] text-ink placeholder:text-muted"
                  />
                  <button
                    type="submit"
                    className="h-12 shrink-0 rounded-[6px] bg-signal px-5 text-[15px] font-semibold text-signal-ink transition-opacity hover:opacity-90"
                  >
                    Analyze profile
                  </button>
                </div>
                {inputError ? (
                  <p className="mt-3 text-[13px] text-danger" role="alert">
                    {inputError}
                  </p>
                ) : (
                  <p className="mt-3 text-[13px] text-muted">
                    No account needed. Public data only.
                  </p>
                )}
              </form>
            </div>

            <div className="hidden bg-line lg:block" aria-hidden="true" />

            <div className="fade-in self-start rounded-[6px] border border-line bg-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-[13px] font-semibold text-ink">Specimen</p>
                <a
                  href={`https://github.com/${SPECIMEN.login}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[12px] text-muted underline decoration-line underline-offset-4 transition-colors hover:text-signal"
                >
                  github.com/{SPECIMEN.login}
                </a>
              </div>

              <div className="mt-5">
                <LanguageBar items={SPECIMEN.languages} />
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4">
                <div>
                  <dt className="text-[12px] text-muted">Repositories</dt>
                  <dd className="mt-1 font-mono text-[15px] tabular-nums text-ink">
                    {fmt.format(SPECIMEN.repositories)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Stars</dt>
                  <dd className="mt-1 font-mono text-[15px] tabular-nums text-ink">
                    {fmt.format(SPECIMEN.stars)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-muted">Followers</dt>
                  <dd className="mt-1 font-mono text-[15px] tabular-nums text-ink">
                    {fmt.format(SPECIMEN.followers)}
                  </dd>
                </div>
              </dl>

              <p className="mt-5 text-[12px] leading-relaxed text-muted">
                Read from public GitHub data. Another developer reads completely
                differently — that is the point.
              </p>
            </div>
          </div>
        </section>

        <section id="measures" className="border-t border-line py-12 sm:py-16">
          <h2 className="display text-[clamp(1.4rem,2.4vw,1.9rem)] text-ink">
            What the report measures
          </h2>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.6] text-muted">
            Every number is computed from public repositories, and the same
            numbers are shown to the person being read. Same profile, same
            result, every time.
          </p>

          <dl className="mt-8 divide-y divide-line border-t border-line">
            {MEASURES.map((measure) => (
              <div
                key={measure.name}
                className="grid gap-1 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8"
              >
                <dt className="text-[15px] font-semibold text-ink">
                  {measure.name}
                </dt>
                <dd className="max-w-[68ch] text-[15px] leading-[1.6] text-muted">
                  {measure.reading}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="account" className="border-t border-line py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-14">
            <div>
              <h2 className="display max-w-[22ch] text-[clamp(1.4rem,2.4vw,1.9rem)] text-ink">
                An account keeps the work you have already done.
              </h2>

              <dl className="mt-8 divide-y divide-line border-t border-line">
                {KEPT.map((item) => (
                  <div key={item.name} className="py-4">
                    <dt className="text-[15px] font-semibold text-ink">
                      {item.name}
                    </dt>
                    <dd className="mt-1 max-w-[62ch] text-[15px] leading-[1.6] text-muted">
                      {item.reading}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-6 text-[13px] text-muted">
                Analyzing never requires an account.
              </p>
            </div>

            <SignInPanel />
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 text-[12px] text-muted sm:px-8">
          <p>Public GitHub data, read the same way every time.</p>
          <p>Not affiliated with GitHub.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
