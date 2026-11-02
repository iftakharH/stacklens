import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError, getSharedReport } from '../api/client';
import type { StoredReport } from '../types';
import ErrorCard from '../components/ErrorCard';
import ReportView from '../components/ReportView';
import { SkeletonPulse } from '../components/ui';

type ShareState =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; data: StoredReport };

const SharePage = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ShareState>({ status: 'loading' });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await getSharedReport(token);
        if (!cancelled) setState({ status: 'ready', data });
      } catch (err) {
        const error =
          err instanceof ApiError
            ? err
            : new ApiError({
                code: 'UNKNOWN',
                status: 0,
                retryable: true,
                message: 'Could not load this shared report.',
              });
        if (!cancelled) setState({ status: 'error', error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token || state.status === 'loading') {
    return (
      <main className="flex flex-1 flex-col">
        <SkeletonPulse label="Opening shared report" />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="flex flex-1 flex-col">
        <ErrorCard
          error={state.error}
          title={state.error.code === 'NOT_FOUND' ? 'Share link unavailable' : undefined}
          hint={
            state.error.code === 'NOT_FOUND'
              ? 'This share link is invalid, has expired, or was revoked.'
              : undefined
          }
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="border-t border-line-strong pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="display-tight text-[clamp(1.3rem,2.6vw,1.9rem)] text-ink">
            A developer snapshot, shared with you.
          </h2>
          <span className="rail-sm shrink-0 text-muted">Shared report</span>
        </div>
        <div aria-hidden="true" className="ticks-x-subtle mt-3" />
      </header>

      <ReportView username={state.data.username} report={state.data.report} />

      <p className="rail-sm border-t border-line pt-4 text-center text-muted">
        Generated with{' '}
        <a
          href="/"
          className="text-ink underline decoration-signal underline-offset-4 transition-colors hover:decoration-ink"
        >
          StackLens
        </a>
      </p>
    </main>
  );
};

export default SharePage;
