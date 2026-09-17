import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authClient } from '../api/auth';
import {
  ApiError,
  analyzeProfile,
  createShareLink,
  saveCandidate,
} from '../api/client';
import type { AnalyzeData } from '../types';
import ErrorCard from '../components/ErrorCard';
import ReportView from '../components/ReportView';
import { useSignIn } from '../components/signin-context';
import { Card, SkeletonPulse } from '../components/ui';

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'success'; data: AnalyzeData };

const extractUsernameClient = (raw: string): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('http') && !trimmed.includes('/')) return trimmed;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    const parts = trimmed.split('/').filter(Boolean);
    return parts.pop() || null;
  }
};

const actionButtonClass =
  'inline-flex h-11 items-center justify-center rounded-[6px] border border-line px-3 text-[13px] font-semibold text-ink transition-colors hover:border-signal disabled:cursor-not-allowed disabled:opacity-60';

const primaryActionButtonClass =
  'inline-flex h-11 items-center justify-center rounded-[6px] bg-signal px-4 text-[13px] font-semibold text-signal-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60';

// Save-candidate + share-link actions shown on a fresh analyze result.
// Enabled only for signed-in users when the report was persisted (report_id).
const ResultActions: React.FC<{ data: AnalyzeData }> = ({ data }) => {
  const { data: session, isPending } = authClient.useSession();
  const { openSignIn } = useSignIn();
  const signedIn = !isPending && Boolean(session?.user);
  const enabled = signedIn && data.report_id != null;

  const [note, setNote] = useState('');
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [saveError, setSaveError] = useState('');
  const [shareState, setShareState] = useState<
    'idle' | 'creating' | 'copied' | 'error'
  >('idle');
  const [shareError, setShareError] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const handleSave = async () => {
    setSaveState('saving');
    setSaveError('');
    try {
      await saveCandidate(data.username, note.trim() || undefined);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(
        err instanceof ApiError ? err.message : 'Could not save the candidate.'
      );
    }
  };

  const handleShare = async () => {
    if (data.report_id == null) return;
    setShareState('creating');
    setShareError('');
    setShareUrl('');
    try {
      const link = await createShareLink(data.report_id);
      const url = `${window.location.origin}${link.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setShareState('copied');
      } catch {
        // Clipboard unavailable (permissions / non-secure context) —
        // fall back to showing the link for manual copy.
        setShareUrl(url);
        setShareState('copied');
      }
    } catch (err) {
      setShareState('error');
      setShareError(
        err instanceof ApiError ? err.message : 'Could not create a share link.'
      );
    }
  };

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note for your shortlist (optional)"
              aria-label="Candidate note"
              maxLength={500}
              disabled={!enabled || saveState === 'saving'}
              className="h-11 min-w-0 flex-1 rounded-[6px] border border-line bg-panel px-3 text-[13px] text-ink placeholder:text-muted disabled:opacity-60"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!enabled || saveState === 'saving'}
            className={actionButtonClass}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save candidate'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleShare();
            }}
            disabled={!enabled || shareState === 'creating'}
            className={primaryActionButtonClass}
          >
            {shareState === 'creating' ? 'Creating…' : 'Create share link'}
          </button>
        </div>

        {!enabled && !isPending && !signedIn && (
          <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <span>
              Sign in to save candidates and create share links — analyzing
              stays free without an account.
            </span>
            <button
              type="button"
              onClick={openSignIn}
              className="rounded-[6px] border border-line px-2.5 py-1 text-[13px] font-semibold text-ink transition-colors hover:border-signal"
            >
              Sign in
            </button>
          </p>
        )}
        {!enabled && signedIn && (
          <p className="text-[13px] text-muted">
            Reports aren&apos;t being stored on this server, so saving and
            sharing are unavailable.
          </p>
        )}

        {saveState === 'saved' && (
          <p className="text-[13px] text-signal" role="status">
            Saved — see your shortlist on the Saved page.
          </p>
        )}
        {saveState === 'error' && (
          <p className="text-[13px] text-danger" role="alert">
            {saveError}
          </p>
        )}

        {shareState === 'copied' && (
          <p className="text-[13px] text-signal" role="status">
            Link copied{shareUrl ? '' : ' to your clipboard'} — anyone with it
            can view this report.
          </p>
        )}
        {shareUrl && (
          <input
            type="text"
            readOnly
            value={shareUrl}
            aria-label="Share link"
            onFocus={(e) => e.target.select()}
            className="h-11 w-full rounded-[6px] border border-line bg-paper px-3 text-[13px] text-muted"
          />
        )}
        {shareState === 'error' && (
          <p className="text-[13px] text-danger" role="alert">
            {shareError}
          </p>
        )}
      </div>
    </Card>
  );
};

const AnalyzePage = () => {
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState<string>(
    () => searchParams.get('q') ?? ''
  );
  const [state, setState] = useState<AnalysisState>(() =>
    searchParams.get('q') ? { status: 'loading' } : { status: 'idle' }
  );
  const ranInitialQuery = useRef(false);

  // Runs an analysis and lands in a terminal state (success / error).
  // Every setState happens behind an await so this is safe to call from
  // effects; callers set the 'loading' state themselves.
  const runAnalysis = useCallback(async (raw: string) => {
    const username = extractUsernameClient(raw);

    const outcome = await (username
      ? analyzeProfile(raw).then(
          (data) => ({ kind: 'success' as const, data }),
          (err: unknown) => ({
            kind: 'error' as const,
            error:
              err instanceof ApiError
                ? err
                : new ApiError({
                    code: 'UNKNOWN',
                    status: 0,
                    retryable: true,
                    message: 'Something went wrong while analyzing.',
                  }),
          })
        )
      : Promise.resolve({
          kind: 'error' as const,
          error: new ApiError({
            code: 'VALIDATION',
            status: 400,
            retryable: false,
            message: 'Please enter a valid GitHub URL or username.',
          }),
        }));

    setState(
      outcome.kind === 'success'
        ? { status: 'success', data: outcome.data }
        : { status: 'error', error: outcome.error }
    );
  }, []);

  // Auto-run once when arriving with /?q=<username> (e.g. from the Saved
  // page "Analyze" link). The input is prefilled from the URL directly in
  // the initial state above.
  useEffect(() => {
    if (ranInitialQuery.current) return;
    ranInitialQuery.current = true;
    const q = searchParams.get('q') ?? '';
    if (!q) return;

    (async () => {
      await runAnalysis(q);
    })();
  }, [searchParams, runAnalysis]);

  const handleAnalyze = useCallback(
    async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      setState({ status: 'loading' });
      await runAnalysis(input);
    },
    [input, runAnalysis]
  );

  return (
    <main className="flex flex-1 flex-col gap-4 sm:gap-5">
      {/* Search sits in a full-width bar so the candidate report below gets the
          whole canvas — the profile is the product, not a sidebar. */}
      <section className="rounded-[6px] border border-line bg-panel p-4 sm:p-5">
        <form onSubmit={handleAnalyze}>
          <label
            htmlFor="github-profile-input"
            className="block text-[13px] font-medium text-ink"
          >
            GitHub profile URL or username
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="github-profile-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://github.com/username"
              className="h-11 min-w-0 flex-1 rounded-[6px] border border-line bg-paper px-3 text-[14px] text-ink placeholder:text-muted sm:max-w-[460px]"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-[6px] bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' ? 'Analyzing…' : 'Analyze profile'}
            </button>
            {state.status === 'loading' && (
              <span className="flex items-center sm:pl-2">
                <SkeletonPulse />
              </span>
            )}
          </div>

          {state.status === 'error' && (
            <div className="mt-3">
              <ErrorCard
                error={state.error}
                onRetry={() => {
                  setState({ status: 'loading' });
                  void runAnalysis(input);
                }}
              />
            </div>
          )}
          {state.status === 'idle' && (
            <p className="mt-3 text-[13px] text-muted">
              Public data only · no token required. Paste a profile to build the
              report.
            </p>
          )}
        </form>
      </section>

      <section className="min-w-0 space-y-3 sm:space-y-4">
        {state.status === 'success' ? (
          <>
            <ResultActions
              key={state.data.report_id ?? state.data.username}
              data={state.data}
            />
            <ReportView
              username={state.data.username}
              report={state.data.report}
            />
          </>
        ) : (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center sm:py-12">
              <p className="text-[13px] font-semibold text-ink">Developer report</p>
              <h2 className="text-lg font-semibold text-ink sm:text-xl">
                Your next candidate, in one glance.
              </h2>
              <p className="max-w-sm text-[13px] leading-relaxed text-muted">
                Paste a GitHub profile to see a compact overview of stack, activity, and
                signal — so you can move from resume to conversation faster.
              </p>
            </div>
          </Card>
        )}
      </section>
    </main>
  );
};

export default AnalyzePage;
