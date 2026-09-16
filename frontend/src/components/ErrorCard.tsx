import { useEffect, useState } from 'react';
import type { ApiError } from '../api/client';

const RETRYABLE_CODES = new Set(['UPSTREAM_ERROR', 'NETWORK', 'INTERNAL']);

const COPY: Record<string, { title: string; hint?: string }> = {
  NOT_FOUND: {
    title: 'GitHub user not found',
    hint: 'Double-check the spelling or URL, then try another profile.',
  },
  RATE_LIMITED: { title: 'Too many requests' },
  UPSTREAM_ERROR: { title: 'GitHub is unreachable right now' },
  NETWORK: { title: 'Cannot reach the server' },
  INTERNAL: { title: 'Something went wrong' },
  VALIDATION: { title: 'Invalid input' },
};

const countdownFor = (error: ApiError): number =>
  error.code === 'RATE_LIMITED' ? Math.max(0, Math.ceil(error.retryAfter ?? 60)) : 0;

type ErrorCardProps = {
  error: ApiError;
  onRetry?: () => void;
  /** Overrides the default title for this error code (e.g. share links). */
  title?: string;
  /** Overrides the default hint for this error code (e.g. share links). */
  hint?: string;
};

const ErrorCard: React.FC<ErrorCardProps> = ({ error, onRetry, title, hint }) => {
  const rateLimited = error.code === 'RATE_LIMITED';
  const [seconds, setSeconds] = useState(() => countdownFor(error));
  const [prevError, setPrevError] = useState(error);

  if (prevError !== error) {
    setPrevError(error);
    setSeconds(countdownFor(error));
  }

  const finished = seconds <= 0;

  useEffect(() => {
    if (!rateLimited || finished) return undefined;
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [rateLimited, finished]);

  const copy = COPY[error.code] ?? { title: 'Request failed' };
  const heading = title ?? copy.title;
  const showRetry =
    onRetry !== undefined && (RETRYABLE_CODES.has(error.code) || rateLimited);
  const retryDisabled = rateLimited && seconds > 0;

  const description = rateLimited
    ? `Rate limit reached — try again in ${seconds}s.`
    : (hint ?? copy.hint ?? error.message);

  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-300/70 bg-rose-50/90 px-3.5 py-3 dark:border-rose-500/30 dark:bg-rose-950/40"
    >
      <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
        {heading}
      </p>
      <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
        {description}
      </p>
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className="mt-2 inline-flex items-center rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-slate-800 dark:text-rose-300 dark:hover:bg-slate-700"
        >
          {retryDisabled ? `Try again in ${seconds}s` : 'Try again'}
        </button>
      )}
    </div>
  );
};

export default ErrorCard;
