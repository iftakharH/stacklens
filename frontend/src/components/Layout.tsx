import { Link, NavLink, Outlet } from 'react-router-dom';
import { authClient } from '../api/auth';
import { useTheme } from '../lib/useTheme';
import AuthControls from './AuthControls';
import SignInProvider from './SignInProvider';
import { Registration } from './ui';

/** The mark is a registration target, not a logo tile. */
const LensMark: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-5 w-5 shrink-0 text-signal sm:h-[22px] sm:w-[22px]"
  >
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <path
      d="M12 0.5v4M12 19.5v4M0.5 12h4M19.5 12h4"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const ThemeToggle: React.FC<{ dark: boolean; onToggle: () => void }> = ({
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

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-9 items-center px-2.5 rail transition-colors ${
    isActive
      ? 'text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-signal'
      : 'text-muted hover:text-ink'
  }`;

/**
 * App shell: the page is one calibration card. A single frame carries the
 * wordmark, the navigation, the routed surface, and the edge-code rail that
 * stamps what this card is reading.
 */
const Layout = () => {
  const { dark, toggle } = useTheme();

  const { data: session, isPending } = authClient.useSession();
  const signedIn = !isPending && Boolean(session?.user);

  return (
    <SignInProvider>
      <div className="ground min-h-screen">
        <div className="mx-auto w-full max-w-[1400px] px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
          <div className="frame flex min-h-[calc(100vh-1.5rem)] flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-9 lg:py-7">
            <Registration />

            <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4 sm:pb-5">
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  to="/"
                  className="flex min-w-0 items-center gap-2.5"
                  aria-label="StackLens home"
                >
                  <LensMark />
                  <h1 className="display-tight truncate text-[0.9375rem] text-ink sm:text-base">
                    StackLens
                  </h1>
                </Link>
                <span
                  aria-hidden="true"
                  className="hidden h-4 w-px shrink-0 bg-line-strong sm:block"
                />
                <p className="hidden min-w-0 truncate text-[12px] text-muted md:block">
                  See the developer behind the repositories.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3.5">
                {signedIn && (
                  <nav className="-ml-2.5 flex items-center" aria-label="Main navigation">
                    <NavLink to="/analyze" className={navLinkClass}>
                      Analyze
                    </NavLink>
                    <NavLink to="/saved" className={navLinkClass}>
                      Saved
                    </NavLink>
                    <NavLink to="/history" className={navLinkClass}>
                      History
                    </NavLink>
                  </nav>
                )}
                <AuthControls />
                <ThemeToggle dark={dark} onToggle={toggle} />
              </div>
            </header>

            <div aria-hidden="true" className="ticks-x" />

            <main className="flex-1 pt-5 sm:pt-6">
              <Outlet />
            </main>

            <footer className="mt-10 border-t border-line pt-4 sm:mt-12">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <p className="rail-sm text-muted">
                  Public GitHub data · read the same way every time
                </p>
                <p className="rail-sm text-muted">Not affiliated with GitHub</p>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </SignInProvider>
  );
};

export default Layout;
