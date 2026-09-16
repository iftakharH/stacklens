import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authClient } from '../api/auth';
import {
  ApiError,
  deleteCandidate,
  listCandidates,
} from '../api/client';
import type { Candidate } from '../types';
import ErrorCard from '../components/ErrorCard';
import { Card, SignInRequiredCard, SkeletonPulse } from '../components/ui';

const GATE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sign in to save candidates.',
  CONFIG_MISSING: 'Accounts are not configured on this server yet.',
};

const isGateError = (err: ApiError) =>
  err.code === 'UNAUTHORIZED' || err.code === 'CONFIG_MISSING';

const analyzeLinkClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 dark:border-primary-soft/40 dark:bg-primary-soft/10 dark:text-primary-soft dark:hover:bg-primary-soft/20';

const deleteButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:text-rose-400';

const CandidateRow: React.FC<{
  candidate: Candidate;
  deleting: boolean;
  onDelete: (id: string) => void;
}> = ({ candidate, deleting, onDelete }) => (
  <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 transition dark:border-slate-600 dark:bg-slate-800/50 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          @{candidate.github_username}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {new Date(candidate.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
      {candidate.note && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
          {candidate.note}
        </p>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <Link
        to={`/?q=${encodeURIComponent(candidate.github_username)}`}
        className={analyzeLinkClass}
      >
        Analyze →
      </Link>
      <button
        type="button"
        onClick={() => onDelete(candidate.id)}
        disabled={deleting}
        className={deleteButtonClass}
        aria-label={`Remove ${candidate.github_username} from saved candidates`}
      >
        {deleting ? 'Removing…' : 'Remove'}
      </button>
    </div>
  </div>
);

const SavedPage = () => {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'gate'; message: string }
    | { status: 'error'; error: ApiError }
    | { status: 'ready'; items: Candidate[] }
  >({ status: 'loading' });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Refetch used by the delete flow (event handler context). Lands in a
  // terminal state (ready / gate / error); every setState happens behind an
  // await.
  const load = useCallback(async () => {
    try {
      const data = await listCandidates();
      setState({ status: 'ready', items: data.items });
    } catch (err) {
      const error =
        err instanceof ApiError
          ? err
          : new ApiError({
              code: 'UNKNOWN',
              status: 0,
              retryable: true,
              message: 'Could not load your saved candidates.',
            });
      if (isGateError(error)) {
        setState({
          status: 'gate',
          message: GATE_MESSAGES[error.code] ?? 'Sign in to save candidates.',
        });
      } else {
        setState({ status: 'error', error });
      }
    }
  }, []);

  // Initial load (and reloads triggered by the retry button via reloadToken)
  // for signed-in users, with unmount/sign-out cancellation.
  useEffect(() => {
    if (sessionPending || !signedIn) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const data = await listCandidates();
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
                message: 'Could not load your saved candidates.',
              });
        if (isGateError(error)) {
          setState({
            status: 'gate',
            message: GATE_MESSAGES[error.code] ?? 'Sign in to save candidates.',
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

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCandidate(id);
      await load();
    } catch (err) {
      const error =
        err instanceof ApiError
          ? err
          : new ApiError({
              code: 'UNKNOWN',
              status: 0,
              retryable: true,
              message: 'Could not remove the candidate.',
            });
      setState({ status: 'error', error });
    } finally {
      setDeletingId(null);
    }
  };

  // Order matters: resolve the session first, then gate signed-out visitors
  // (state stays 'loading' for them — the data fetch never runs), and only
  // then show the data-loading skeleton for signed-in users.
  if (sessionPending) {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <SkeletonPulse label="Loading your shortlist…" />
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

  if (state.status === 'loading') {
    return (
      <main className="flex flex-1 flex-col gap-4">
        <SkeletonPulse label="Loading your shortlist…" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4">
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary-soft sm:text-xs">
          Shortlist
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-50 sm:text-2xl">
          Saved candidates
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
          Developers you bookmarked while analyzing GitHub profiles.
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
              Empty shortlist
            </p>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 sm:text-xl">
              No saved candidates yet.
            </h2>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Analyze a GitHub profile and hit “Save candidate” to keep it here
              with a note.
            </p>
            <Link to="/" className={analyzeLinkClass}>
              Analyze a profile →
            </Link>
          </div>
        </Card>
      )}

      {state.status === 'ready' && state.items.length > 0 && (
        <Card>
          <div className="space-y-2 sm:space-y-2.5">
            {state.items.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                deleting={deletingId === candidate.id}
                onDelete={(id) => {
                  void handleDelete(id);
                }}
              />
            ))}
          </div>
        </Card>
      )}
    </main>
  );
};

export default SavedPage;
