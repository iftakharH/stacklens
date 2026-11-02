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
import { EmptyField, SkeletonPulse } from '../components/ui';
import extractUsername from '../lib/username';

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'success'; data: AnalyzeData };

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
    'idle' | 'creating' | 'copied' | 'created' | 'error'
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
        // Clipboard unavailable (permissions / non-secure context) — never
        // claim it was copied; show the link for manual copy instead.
        setShareUrl(url);
        setShareState('created');
      }
    } catch (err) {
      setShareState('error');
      setShareError(
        err instanceof ApiError ? err.message : 'Could not create a share link.'
      );
    }
  };

  return (
    <div className="border-y border-line py-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <span className="rail shrink-0 text-muted lg:w-[7.5rem]">Keep reading</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Candidate note"
          maxLength={500}
          disabled={!enabled || saveState === 'saving'}
          className="field-input h-10 flex-1 text-[13px]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!enabled || saveState === 'saving'}
            className="btn btn-sm h-10 flex-1 whitespace-nowrap lg:flex-none"
          >
            {saveState === 'saving' ? 'Saving…' : 'Save candidate'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleShare();
            }}
            disabled={!enabled || shareState === 'creating'}
            className="btn btn-primary btn-sm h-10 flex-1 whitespace-nowrap lg:flex-none"
          >
            {shareState === 'creating' ? 'Creating…' : 'Create share link'}
          </button>
        </div>
      </div>

      {!enabled && !isPending && !signedIn && (
        <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span>
            Sign in to save candidates and create share links — analyzing stays
            free without an account.
          </span>
          <button
            type="button"
            onClick={openSignIn}
            className="rail border border-line-strong px-2 py-1 text-ink transition-colors hover:border-signal"
          >
            Sign in
          </button>
        </p>
      )}
      {!enabled && signedIn && (
        <p className="mt-2.5 text-[12px] text-muted">
          Reports aren&apos;t being stored on this server, so saving and sharing
          are unavailable.
        </p>
      )}

      {saveState === 'saved' && (
        <p className="rail-sm mt-2.5 text-signal" role="status">
          Saved — see your shortlist on the Saved page
        </p>
      )}
      {saveState === 'error' && (
        <p className="mt-2.5 text-[12px] text-danger" role="alert">
          {saveError}
        </p>
      )}

      {shareState === 'copied' && (
        <p className="rail-sm mt-2.5 text-signal" role="status">
          Link copied to your clipboard — anyone with it can view this report
        </p>
      )}
      {shareState === 'created' && (
        <p className="rail-sm mt-2.5 text-signal" role="status">
          Share link created below — anyone with it can view this report
        </p>
      )}
      {shareUrl && (
        <input
          type="text"
          readOnly
          value={shareUrl}
          aria-label="Share link"
          onFocus={(e) => e.target.select()}
          className="field-input mt-2.5 h-10 text-[12px]"
        />
      )}
      {shareState === 'error' && (
        <p className="mt-2.5 text-[12px] text-danger" role="alert">
          {shareError}
        </p>
      )}
    </div>
  );
};

const AnalyzePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQ = searchParams.get('q') ?? '';
  // The page REMOUNTS when the ?q= in the URL changes (key in App.tsx), so
  // the URL is always the prefill source at mount; input state is only
  // rewritten by the user from here on.
  const [input, setInput] = useState<string>(() => currentQ);
  const [state, setState] = useState<AnalysisState>(() =>
    currentQ ? { status: 'loading' } : { status: 'idle' }
  );
  // Bumped per run so a finished reading can replay the acquisition sweep
  // even when re-analyzing the same profile.
  const [runSeq, setRunSeq] = useState(0);
  // Guard against a stale response (slower older request) overwriting a
  // newer result: every run checks its ticket before committing state.
  const runSeqRef = useRef(0);

  // Runs an analysis: sets the loading state synchronously, then commits the
  // terminal state behind an await — and only if its run is still the latest.
  const runAnalysis = useCallback(
    async (raw: string) => {
      const ticket = ++runSeqRef.current;
      setRunSeq(ticket);
      setState({ status: 'loading' });

      const username = extractUsername(raw);

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
            }),
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

      if (ticket !== runSeqRef.current) return;

      setState(
        outcome.kind === 'success'
          ? { status: 'success', data: outcome.data }
          : { status: 'error', error: outcome.error }
      );

      // Successful reads keep the ?q= in the URL so refresh/back restores
      // the reading. It mirrors what was actually analyzed, not the raw
      // input (a GitHub profile URL round-trips to its username). Skipped
      // when the URL already carries this q.
      if (outcome.kind === 'success' && username && currentQ !== username) {
        setSearchParams({ q: username }, { replace: true });
      }
    },
    [currentQ, setSearchParams],
  );

  // Arriving with /?q=<username> runs the analysis automatically — once per
  // mount. The page remounts on a changed q (see App.tsx), so repeated runs
  // happen only when the user actually navigates there fresh.
  const ranOnMount = useRef(false);
  useEffect(() => {
    if (ranOnMount.current || !currentQ) return;
    ranOnMount.current = true;
    void runAnalysis(currentQ);
  }, [currentQ, runAnalysis]);

  const handleAnalyze = useCallback(
    async (e: React.SyntheticEvent<HTMLFormElement>) => {
      e.preventDefault();
      await runAnalysis(input);
    },
    [input, runAnalysis]
  );

  return (
    <main className="flex flex-1 flex-col">
      {/* The control surface. Full-width, so the reading below gets the whole
          card — the profile is the product, not a sidebar. */}
      <section className="-mt-1 border-t border-line-strong pt-4">
        <form onSubmit={handleAnalyze}>
          <label
            htmlFor="github-profile-input"
            className="rail block text-muted"
          >
            GitHub profile URL or username
          </label>
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="github-profile-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://github.com/username"
              className="field-input flex-1 sm:max-w-[32rem]"
            />
            <button
              type="submit"
              className="btn btn-primary shrink-0 px-5"
              disabled={state.status === 'loading'}
            >
              {state.status === 'loading' ? 'Analyzing…' : 'Analyze profile'}
            </button>
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
            <p className="rail-sm mt-3 text-muted">
              Public data only · no token required
            </p>
          )}
          {state.status === 'success' && (
            <p className="rail-sm mt-3 text-muted">
              Reading complete · {state.data.username}
            </p>
          )}
        </form>
      </section>

      <section className="mt-6 min-w-0 sm:mt-8">
        {state.status === 'success' ? (
          <div className="acquire space-y-4 sm:space-y-5" key={runSeq}>
            <ResultActions
              key={state.data.report_id ?? state.data.username}
              data={state.data}
            />
            <ReportView
              username={state.data.username}
              report={state.data.report}
            />
          </div>
        ) : state.status === 'loading' ? (
          <SkeletonPulse label="Acquiring reading" />
        ) : (
          <EmptyField
            kicker="No reading on the card"
            heading="Your next candidate, in one glance."
            body="Paste a GitHub profile to see a compact overview of stack, activity, and signal — so you can move from resume to conversation faster."
          />
        )}
      </section>
    </main>
  );
};

export default AnalyzePage;
