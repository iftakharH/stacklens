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

/**
 * A failed reading. Set as a flagged plate: the error code is stamped in mono,
 * the problem and the recovery are named in the product's own words.
 */
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
      className="surface-error flex flex-col gap-2 border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <p className="rail text-danger">Reading failed · {error.code}</p>
        <p className="mt-2 text-[13px] font-semibold text-ink">{heading}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink2">{description}</p>
      </div>
      {showRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className="btn btn-sm shrink-0 self-start"
        >
          {retryDisabled ? `Try again in ${seconds}s` : 'Try again'}
        </button>
      )}
    </div>
  );
};

export default ErrorCard;
