import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { authClient } from '../api/auth';
import {
  ApiError,
  getHistoryReport,
  listHistory,
} from '../api/client';
import type { HistoryItem, StoredReport } from '../types';
import ErrorCard from '../components/ErrorCard';
import ReportView from '../components/ReportView';
import { EmptyField, SignInRequiredCard, SkeletonPulse } from '../components/ui';

const GATE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sign in to see your report history.',
  CONFIG_MISSING: 'Accounts are not configured on this server yet.',
};

const isGateError = (err: ApiError) =>
  err.code === 'UNAUTHORIZED' || err.code === 'CONFIG_MISSING';

const HistoryRow: React.FC<{
  item: HistoryItem;
  onOpen: (id: string) => void;
}> = ({ item, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(item.id)}
    className="group flex w-full flex-col gap-2 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
  >
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="num truncate text-[13px] font-semibold text-ink transition-colors group-hover:text-signal">
        @{item.github_username}
      </span>
      <span className="rail-sm text-muted">
        {new Date(item.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-4">
      {item.hireability && (
        <span className="rail-sm border border-line px-2 py-1 text-ink2">
          {item.hireability}
        </span>
      )}
      <span className="num text-[15px] font-semibold text-ink">
        {item.overall != null ? item.overall.toFixed(1) : '—'}
        <span className="ml-1 text-[11px] font-normal text-muted">/ 10</span>
      </span>
    </div>
  </button>
);

type HistoryState =
  | { status: 'loading' }
  | { status: 'gate'; message: string }
  | { status: 'error'; error: ApiError }
  | { status: 'ready'; items: HistoryItem[] };

const HistoryPage = () => {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const [state, setState] = useState<HistoryState>({ status: 'loading' });
  const [reloadToken, setReloadToken] = useState(0);
  const openSeq = useRef(0);

  // Sub-view: the stored report opened from the list.
  const [selected, setSelected] = useState<{
    id: string;
    status: 'loading' | 'ready' | 'error';
    report?: StoredReport;
    error?: ApiError;
  } | null>(null);

  // Initial load (and reloads triggered by the retry button via reloadToken)
  // for signed-in users, with unmount/sign-out cancellation.
  useEffect(() => {
    if (sessionPending || !signedIn) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const data = await listHistory();
        if (!cancelled) setState({ status: 'ready', items: data.items });
      } catch (err) {
        if (cancelled) return;
        const error =
          err instanceof ApiError
            ? err
            : new ApiError({
                code: 'UNKNOWN',
                status: 0,
                retryable: true,
                message: 'Could not load your report history.',
              });
        if (isGateError(error)) {
          setState({
            status: 'gate',
            message: GATE_MESSAGES[error.code] ?? GATE_MESSAGES.UNAUTHORIZED,
          });
        } else {
          setState({ status: 'error', error });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionPending, signedIn, reloadToken]);

  const openReport = useCallback(async (id: string) => {
    // Selection order guard: a slow earlier fetch must never overwrite a
    // newer selection — every open carries a ticket, only the newest wins.
    const ticket = ++openSeq.current;
    setSelected({ id, status: 'loading' });
    try {
      const report = await getHistoryReport(id);
      if (ticket !== openSeq.current) return;
      setSelected({ id, status: 'ready', report });
    } catch (err) {
      const error =
        err instanceof ApiError
          ? err
          : new ApiError({
              code: 'UNKNOWN',
              status: 0,
              retryable: true,
              message: 'Could not open the stored report.',
            });
      if (ticket !== openSeq.current) return;
      setSelected({ id, status: 'error', error });
    }
  }, []);

  // Order matters: resolve the session first, then gate signed-out visitors
  // (state stays 'loading' for them — the data fetch never runs), and only
  // then show the data-loading skeleton for signed-in users.
  if (sessionPending) {
    return (
      <main className="flex flex-1 flex-col">
        <SkeletonPulse label="Loading your history" />
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="flex flex-1 flex-col">
        <SignInRequiredCard message={GATE_MESSAGES.UNAUTHORIZED} />
      </main>
    );
  }

  if (state.status === 'loading' && !selected) {
    return (
      <main className="flex flex-1 flex-col">
        <SkeletonPulse label="Loading your history" />
      </main>
    );
  }

  if (selected) {
    return (
      <main className="flex flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="btn btn-sm"
          >
            ← Back to history
          </button>
          {selected.status === 'ready' && selected.report && (
            <span className="rail-sm text-muted">
              Analyzed{' '}
              {new Date(selected.report.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          )}
        </div>

        {selected.status === 'loading' && (
          <SkeletonPulse label="Opening stored report" />
        )}
        {selected.status === 'error' && selected.error && (
          <ErrorCard
            error={selected.error}
            onRetry={() => void openReport(selected.id)}
          />
        )}
        {selected.status === 'ready' && selected.report && (
          <ReportView
            username={selected.report.username}
            report={selected.report.report}
          />
        )}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="border-t border-line-strong pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="display-tight text-[clamp(1.3rem,2.6vw,1.9rem)] text-ink">
            Profiles you analyzed
          </h2>
          <span className="rail-sm text-muted">
            {state.status === 'ready' ? `${state.items.length} stored` : '—'}
          </span>
        </div>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-muted">
          Every profile you analyze while signed in is stored here — click one
          to reopen the full report.
        </p>
        <div aria-hidden="true" className="ticks-x-subtle mt-3" />
      </header>

      {state.status === 'error' && (
        <ErrorCard
          error={state.error}
          onRetry={() => {
            setState({ status: 'loading' });
            setReloadToken((t) => t + 1);
          }}
        />
      )}

      {state.status === 'ready' && state.items.length === 0 && (
        <EmptyField
          kicker="History · empty"
          heading="No stored reports."
          body="Analyze a GitHub profile while signed in and it will appear here automatically."
          action={
            <Link to="/analyze" className="btn btn-sm">
              Analyze a profile
            </Link>
          }
        />
      )}

      {state.status === 'ready' && state.items.length > 0 && (
        <div className="ledger border-t border-line-strong">
          {state.items.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              onOpen={(id) => void openReport(id)}
            />
          ))}
        </div>
      )}
    </main>
  );
};

export default HistoryPage;
