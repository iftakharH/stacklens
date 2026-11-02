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
import { EmptyField, SignInRequiredCard, SkeletonPulse } from '../components/ui';

const GATE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sign in to save candidates.',
  CONFIG_MISSING: 'Accounts are not configured on this server yet.',
};

const isGateError = (err: ApiError) =>
  err.code === 'UNAUTHORIZED' || err.code === 'CONFIG_MISSING';

const CandidateRow: React.FC<{
  candidate: Candidate;
  deleting: boolean;
  onDelete: (id: string) => void;
}> = ({ candidate, deleting, onDelete }) => (
  <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num truncate text-[13px] font-semibold text-ink">
          @{candidate.github_username}
        </span>
        <span className="rail-sm text-muted">
          {new Date(candidate.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
      {candidate.note && (
        <p className="mt-1.5 line-clamp-2 max-w-[62ch] text-[13px] leading-[1.55] text-muted">
          {candidate.note}
        </p>
      )}
    </div>
    <div className="flex shrink-0 items-center gap-2">
      <Link
        to={`/analyze?q=${encodeURIComponent(candidate.github_username)}`}
        className="btn btn-sm"
      >
        Analyze
      </Link>
      <button
        type="button"
        onClick={() => onDelete(candidate.id)}
        disabled={deleting}
        className="btn btn-sm border-line text-muted hover:border-danger hover:text-danger"
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

  // Shared failure classifier: gate errors (sign-in / server-configuration)
  // land in their own UI states; anything else is a retryable error card.
  const classify = useCallback((err: unknown) => {
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
        message: GATE_MESSAGES[error.code] ?? GATE_MESSAGES.UNAUTHORIZED,
      });
    } else {
      setState({ status: 'error', error });
    }
  }, []);

  // Fetch + commit (event-handler context). Every setState happens behind an
  // await so both the effect below and handleDelete can call it.
  const load = useCallback(async () => {
    try {
      const data = await listCandidates();
      setState({ status: 'ready', items: data.items });
    } catch (err) {
      classify(err);
    }
  }, [classify]);

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
        classify(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionPending, signedIn, reloadToken, classify]);

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
      <main className="flex flex-1 flex-col">
        <SkeletonPulse label="Loading your shortlist" />
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

  if (state.status === 'loading') {
    return (
      <main className="flex flex-1 flex-col">
        <SkeletonPulse label="Loading your shortlist" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="border-t border-line-strong pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="display-tight text-[clamp(1.3rem,2.6vw,1.9rem)] text-ink">
            Saved candidates
          </h2>
          <span className="rail-sm text-muted">
            {state.status === 'ready' ? `${state.items.length} on the card` : '—'}
          </span>
        </div>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-muted">
          Developers you bookmarked while analyzing GitHub profiles.
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
          kicker="Shortlist · empty"
          heading="No saved candidates yet."
          body="Analyze a GitHub profile and hit “Save candidate” to keep it here with a note."
          action={
            <Link to="/analyze" className="btn btn-sm">
              Analyze a profile
            </Link>
          }
        />
      )}

      {state.status === 'ready' && state.items.length > 0 && (
        <div className="ledger border-t border-line-strong">
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
      )}
    </main>
  );
};

export default SavedPage;
