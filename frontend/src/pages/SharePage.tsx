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
      <main className="flex flex-1 flex-col gap-4">
        <SkeletonPulse label="Opening shared report…" />
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="flex flex-1 flex-col gap-4">
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
    <main className="flex flex-1 flex-col gap-4">
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary-soft sm:text-xs">
          Shared report
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-50 sm:text-2xl">
          A developer snapshot, shared with you.
        </h2>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <ReportView
          username={state.data.username}
          report={state.data.report}
        />
      </div>

      <p className="pt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
        Generated with{' '}
        <a
          href="/"
          className="font-medium text-primary hover:underline dark:text-primary-soft"
        >
          StackLens
        </a>
      </p>
    </main>
  );
};

export default SharePage;
