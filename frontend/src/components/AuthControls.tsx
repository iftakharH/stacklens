import { useState } from 'react';
import { authClient } from '../api/auth';

type AuthErrorLike = {
  code?: string;
  status?: number;
  message?: string;
};

type MagicLinkState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

const errorText = (err: AuthErrorLike | null | undefined): string => {
  if (!err) return 'Something went wrong. Please try again.';
  if (err.code === 'CONFIG_MISSING' || err.status === 503) {
    return 'Sign-in is not configured on this server yet.';
  }
  return err.message || 'Something went wrong. Please try again.';
};

const inputClass =
  'min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500';

const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-soft hover:text-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-soft dark:hover:text-primary-soft';

function AuthControls() {
  const { data: session, isPending } = authClient.useSession();
  const [email, setEmail] = useState('');
  const [magic, setMagic] = useState<MagicLinkState>({ status: 'idle' });
  const [socialError, setSocialError] = useState<string | null>(null);

  if (isPending) return null;

  if (session?.user) {
    const user = session.user;
    return (
      <div className="flex items-center gap-2">
        {user.image ? (
          <img
            src={user.image}
            alt={user.name || 'avatar'}
            className="h-8 w-8 rounded-full border border-slate-300 object-cover dark:border-slate-600"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-xs font-bold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {(user.name || user.email || '?').charAt(0).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate text-xs font-medium text-slate-700 dark:text-slate-200 sm:inline">
          {user.name || user.email}
        </span>
        <button
          type="button"
          onClick={() => {
            void authClient.signOut();
          }}
          className={secondaryButtonClass}
        >
          Sign out
        </button>
      </div>
    );
  }

  const handleMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSocialError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setMagic({ status: 'error', message: 'Enter your email address first.' });
      return;
    }
    setMagic({ status: 'sending' });
    const { error } = await authClient.signIn.magicLink({
      email: trimmed,
      callbackURL: '/',
    });
    if (error) {
      setMagic({ status: 'error', message: errorText(error) });
    } else {
      setMagic({ status: 'sent' });
    }
  };

  const handleGithub = async () => {
    setSocialError(null);
    setMagic({ status: 'idle' });
    const { error } = await authClient.signIn.social({
      provider: 'github',
      callbackURL: '/',
    });
    if (error) setSocialError(errorText(error));
  };

  return (
    <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
      <form onSubmit={handleMagicLink} className="flex items-center gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className={`${inputClass} w-40 sm:w-44`}
        />
        <button
          type="submit"
          disabled={magic.status === 'sending'}
          className={secondaryButtonClass}
        >
          {magic.status === 'sending' ? 'Sending…' : 'Email me a magic link'}
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <button
          type="button"
          onClick={() => {
            void handleGithub();
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          Sign in with GitHub
        </button>
      </div>
      {magic.status === 'sent' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
          Check your inbox — a sign-in link is on its way.
        </p>
      )}
      {magic.status === 'error' && (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {magic.message}
        </p>
      )}
      {socialError && (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {socialError}
        </p>
      )}
    </div>
  );
}

export default AuthControls;
