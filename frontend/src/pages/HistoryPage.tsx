import { useCallback, useEffect, useState } from 'react';
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
import { Card, SignInRequiredCard, SkeletonPulse } from '../components/ui';

const GATE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sign in to see your report history.',
  CONFIG_MISSING: 'Accounts are not configured on this server yet.',
};

const isGateError = (err: ApiError) =>
  err.code === 'UNAUTHORIZED' || err.code === 'CONFIG_MISSING';

const backLinkClass =
  'inline-flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-signal';

const HistoryRow: React.FC<{
  item: HistoryItem;
  onOpen: (id: string) => void;
}> = ({ item, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(item.id)}
    className="flex w-full flex-col gap-2 rounded-[6px] border border-line bg-paper p-3 text-left transition-colors hover:border-signal sm:flex-row sm:items-center sm:justify-between"
  >
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="truncate text-[13px] font-semibold text-ink">
        @{item.github_username}
      </span>
      <span className="font-mono text-[11px] text-muted">
        {new Date(item.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-3">
      {item.hireability && (
        <span className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink">
          {item.hireability}
        </span>
      )}
      <span className="font-mono text-lg font-bold tabular-nums text-ink">
        {item.overall != null ? item.overall.toFixed(1) : '—'}
        <span className="text-[13px] font-medium text-muted"> / 10</span>
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
    setSelected({ id, status: 'loading' });
    try {
      const report = await getHistoryReport(id);
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
      setSelected({ id, status: 'error', error });
    }
  }, []);

  // Order matters: resolve the session first, then gate signed-out visitors
  // (state stays 'loading' for them — the data fetch never runs), and only
  // then show the data-loading skeleton for signed-in users.
  if (sessionPending) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <SkeletonPulse label="Loading your history…" />
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <SignInRequiredCard message={GATE_MESSAGES.UNAUTHORIZED} />
      </main>
    );
  }

  if (state.status === 'loading' && !selected) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <SkeletonPulse label="Loading your history…" />
      </main>
    );
  }

  if (selected) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={backLinkClass}
          >
            ← Back to history
          </button>
          {selected.status === 'ready' && selected.report && (
            <span className="text-[13px] text-muted">
              Analyzed{' '}
              {new Date(selected.report.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          )}
        </div>

        {selected.status === 'loading' && (
          <SkeletonPulse label="Opening stored report…" />
        )}
        {selected.status === 'error' && selected.error && (
          <ErrorCard
            error={selected.error}
            onRetry={() => void openReport(selected.id)}
          />
        )}
        {selected.status === 'ready' && selected.report && (
          <div className="space-y-3 sm:space-y-4">
            <ReportView
              username={selected.report.username}
              report={selected.report.report}
            />
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="space-y-1.5">
        <p className="text-[13px] font-semibold text-ink">Report history</p>
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Profiles you analyzed
        </h2>
        <p className="text-[13px] text-muted">
          Every profile you analyze while signed in is stored here — click one
          to reopen the full report.
        </p>
      </div>

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
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center sm:py-12">
            <p className="text-[13px] font-semibold text-ink">Nothing here yet</p>
            <h2 className="text-lg font-semibold text-ink sm:text-xl">
              No stored reports.
            </h2>
            <p className="max-w-sm text-[13px] leading-relaxed text-muted">
              Analyze a GitHub profile while signed in and it will appear here
              automatically.
            </p>
            <Link
              to="/analyze"
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-signal"
            >
              Analyze a profile
            </Link>
          </div>
        </Card>
      )}

      {state.status === 'ready' && state.items.length > 0 && (
        <Card>
          <div className="space-y-2 sm:space-y-2.5">
            {state.items.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                onOpen={(id) => void openReport(id)}
              />
            ))}
          </div>
        </Card>
      )}
    </main>
  );
};

export default HistoryPage;
