import { useState } from 'react';
import { authClient } from '../api/auth';

type SendState =
  | { status: 'idle' | 'sending' | 'sent' }
  | { status: 'error'; message: string };

type AuthErrorLike = { code?: string; status?: number; message?: string };

const errorText = (err: AuthErrorLike | null | undefined): string => {
  if (!err) return 'Something went wrong. Try again.';
  if (err.code === 'CONFIG_MISSING' || err.status === 503) {
    return 'Accounts are not configured on this server, so analyzing is what is available here.';
  }
  return err.message || 'Something went wrong. Try again.';
};

// Sign-in always returns to the app, never to the API origin: success lands on
// the analyzer, failure lands back on the app with ?authError (which renders a
// readable banner). Both are absolute so the split dev setup works too.
const returnUrl = '/analyze';
const failureUrl = '/?authError=1';
const absolute = (path: string) =>
  typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

const GitHubMark: React.FC = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 fill-current">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);

// The two sign-in paths, shared by the landing page panel and the app dialog.
// `idPrefix` keeps DOM ids unique when both are mounted.
const SignInMethods: React.FC<{ idPrefix?: string }> = ({
  idPrefix = 'signin',
}) => {
  const [email, setEmail] = useState('');
  const [send, setSend] = useState<SendState>({ status: 'idle' });
  const [socialError, setSocialError] = useState<string | null>(null);

  const handleGithub = async () => {
    setSocialError(null);
    const { error } = await authClient.signIn.social({
      provider: 'github',
      callbackURL: absolute(returnUrl),
      errorCallbackURL: absolute(failureUrl),
    });
    if (error) setSocialError(errorText(error));
  };

  const handleMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSocialError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setSend({ status: 'error', message: 'Enter your email address first.' });
      return;
    }
    setSend({ status: 'sending' });
    const { error } = await authClient.signIn.magicLink({
      email: trimmed,
      callbackURL: absolute(returnUrl),
      errorCallbackURL: absolute(failureUrl),
    });
    if (error) {
      setSend({ status: 'error', message: errorText(error) });
    } else {
      setSend({ status: 'sent' });
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void handleGithub();
        }}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-ink text-[14px] font-semibold text-paper transition-opacity hover:opacity-90"
      >
        <GitHubMark />
        Sign in with GitHub
      </button>

      <form
        onSubmit={handleMagicLink}
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor={`${idPrefix}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          className="h-11 min-w-0 flex-1 rounded-[6px] border border-line bg-paper px-3 text-[14px] text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={send.status === 'sending'}
          className="h-11 shrink-0 rounded-[6px] border border-line px-4 text-[13px] font-semibold text-ink transition-colors hover:border-signal disabled:opacity-60"
        >
          {send.status === 'sending' ? 'Sending…' : 'Email me a link'}
        </button>
      </form>

      {send.status === 'sent' && (
        <p className="mt-3 text-[13px] text-muted" role="status">
          Check your inbox for the sign-in link.
        </p>
      )}
      {send.status === 'error' && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {send.message}
        </p>
      )}
      {socialError && (
        <p className="mt-3 text-[13px] text-danger" role="alert">
          {socialError}
        </p>
      )}
    </div>
  );
};

export default SignInMethods;
