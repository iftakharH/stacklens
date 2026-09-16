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
  'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-soft hover:text-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-soft dark:hover:text-primary-soft';

const scoreColor = (score: number | null) => {
  if (score == null) return 'text-slate-400';
  if (score >= 8) return 'text-emerald-500 dark:text-emerald-400';
  if (score >= 6) return 'text-amber-500 dark:text-amber-300';
  return 'text-rose-500 dark:text-rose-400';
};

const hireabilityBadge = (label: string | null) => {
  switch (label) {
    case 'Hireable':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/30';
    case 'Strong Junior':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/30';
    case 'Junior Ready':
      return 'bg-primary/15 text-primary-dark dark:text-primary-soft border-primary/30';
    case 'Developing':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30';
    default:
      return 'bg-slate-500/10 text-slate-700 dark:text-slate-200 border-slate-500/20';
  }
};

const HistoryRow: React.FC<{
  item: HistoryItem;
  onOpen: (id: string) => void;
}> = ({ item, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(item.id)}
    className="flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-left transition hover:border-primary/40 hover:bg-slate-100/80 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-primary-soft/40 dark:hover:bg-slate-800/80 sm:flex-row sm:items-center sm:justify-between"
  >
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
        @{item.github_username}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {new Date(item.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-3">
      {item.hireability && (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${hireabilityBadge(item.hireability)}`}
        >
          {item.hireability}
        </span>
      )}
      <span className={`text-lg font-bold tabular-nums ${scoreColor(item.overall)}`}>
        {item.overall != null ? item.overall.toFixed(1) : '—'}
        <span className="text-xs font-medium text-slate-400"> / 10</span>
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
            <span className="text-xs text-slate-500 dark:text-slate-400">
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
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary-soft sm:text-xs">
          Report history
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-50 sm:text-2xl">
          Profiles you analyzed
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
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
            <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary-soft">
              Nothing here yet
            </p>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 sm:text-xl">
              No stored reports.
            </h2>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Analyze a GitHub profile while signed in and it will appear here
              automatically.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 dark:border-primary-soft/40 dark:bg-primary-soft/10 dark:text-primary-soft dark:hover:bg-primary-soft/20"
            >
              Analyze a profile →
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
