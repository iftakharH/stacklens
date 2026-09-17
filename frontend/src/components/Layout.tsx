import { Link, NavLink, Outlet } from 'react-router-dom';
import { authClient } from '../api/auth';
import { useTheme } from '../lib/useTheme';
import AuthControls from './AuthControls';
import SignInProvider from './SignInProvider';

const ThemeToggle: React.FC<{ dark: boolean; onToggle: () => void }> = ({
  dark,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-line text-muted transition-colors hover:border-signal hover:text-ink"
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
  `rounded-[6px] border px-3 py-1.5 text-[13px] font-medium transition-colors ${
    isActive
      ? 'border-line bg-panel text-ink'
      : 'border-transparent text-muted hover:border-line hover:text-ink'
  }`;

// App shell: paper background, header (logo / nav / auth / theme), and the
// routed page below. Nav items only appear for signed-in users.
const Layout = () => {
  const { dark, toggle } = useTheme();

  const { data: session, isPending } = authClient.useSession();
  const signedIn = !isPending && Boolean(session?.user);

  return (
    <SignInProvider>
      <div className="min-h-screen bg-paper text-ink">
        <div className="mx-auto flex min-h-screen max-w-[1320px] flex-col px-3 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-6 md:px-6 lg:px-8 lg:pb-10 xl:px-10">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 sm:mb-6 sm:pb-5 md:mb-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="StackLens home">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-ink text-paper sm:h-10 sm:w-10">
                <span className="text-base font-black sm:text-lg">SL</span>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold tracking-tight text-ink sm:text-lg md:text-xl">
                  StackLens
                </h1>
                <p className="truncate text-[12px] text-muted sm:text-[13px]">
                  See the developer behind the repositories.
                </p>
              </div>
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {signedIn && (
              <nav className="flex items-center gap-1" aria-label="Main navigation">
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

        <Outlet />
        </div>
      </div>
    </SignInProvider>
  );
};

export default Layout;
