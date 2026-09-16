import { Link, NavLink, Outlet } from 'react-router-dom';
import { authClient } from '../api/auth';
import { useTheme } from '../lib/useTheme';
import AuthControls from './AuthControls';

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

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
    isActive
      ? 'border border-primary/40 bg-primary/10 text-primary dark:border-primary-soft/40 dark:bg-primary-soft/10 dark:text-primary-soft'
      : 'border border-transparent text-slate-600 hover:border-slate-300 hover:text-primary dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-primary-soft'
  }`;

// App shell: gradient background, header (logo / nav / auth / theme), and the
// routed page below. Nav items only appear for signed-in users.
const Layout = () => {
  const { dark, toggle } = useTheme();

  const { data: session, isPending } = authClient.useSession();
  const signedIn = !isPending && Boolean(session?.user);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-3 pb-6 pt-4 sm:px-5 sm:pb-8 sm:pt-6 md:px-6 lg:px-8 lg:pb-10 xl:px-10">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6 md:mb-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="StackLens home">
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
  );
};

export default Layout;
