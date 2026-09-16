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
  'inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-soft dark:hover:text-primary-soft dark:disabled:opacity-50';

const primaryActionButtonClass =
  'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-soft px-4 py-2 text-xs font-medium text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60';

// Save-candidate + share-link actions shown on a fresh analyze result.
// Enabled only for signed-in users when the report was persisted (report_id).
const ResultActions: React.FC<{ data: AnalyzeData }> = ({ data }) => {
  const { data: session, isPending } = authClient.useSession();
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
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-white/80 to-white/70 dark:from-primary-soft/5 dark:via-slate-800/80 dark:to-slate-800/60">
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
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in (top right) to save candidates and create share links —
            analyzing stays free without an account.
          </p>
        )}
        {!enabled && signedIn && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reports aren&apos;t being stored on this server, so saving and
            sharing are unavailable.
          </p>
        )}

        {saveState === 'saved' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
            Saved — see your shortlist on the Saved page.
          </p>
        )}
        {saveState === 'error' && (
          <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
            {saveError}
          </p>
        )}

        {shareState === 'copied' && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
          />
        )}
        {shareState === 'error' && (
          <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
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
    <main className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6 xl:gap-8">
      <section className="w-full shrink-0 lg:max-w-[380px] xl:max-w-[420px]">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/90 sm:p-5 md:p-6">
          <div className="mb-4 space-y-1.5 sm:mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary dark:text-primary-soft sm:text-xs">
              Profile Analyzer
            </p>
            <h2 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-50 sm:text-2xl">
              Drop a GitHub profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Paste a URL or username for a recruiter-friendly developer snapshot.
            </p>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-3">
            <label
              htmlFor="github-profile-input"
              className="block text-xs font-medium text-slate-500 dark:text-slate-400"
            >
              GitHub profile URL or username
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="github-profile-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://github.com/username"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-primary-soft px-4 py-2.5 text-sm font-medium text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={state.status === 'loading'}
              >
                {state.status === 'loading' ? 'Analyzing…' : 'Analyze Profile'}
              </button>
            </div>
            {state.status === 'error' && (
              <ErrorCard
                error={state.error}
                onRetry={() => {
                  setState({ status: 'loading' });
                  void runAnalysis(input);
                }}
              />
            )}
            {state.status === 'idle' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Public data only · no token required.
              </p>
            )}
          </form>
        </div>

        <div className="mt-3 sm:mt-4">
          {state.status === 'loading' ? (
            <SkeletonPulse />
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quick technical screening for recruiters.
            </p>
          )}
        </div>
      </section>

      <section className="min-w-0 flex-1 space-y-3 sm:space-y-4">
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
              <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary-soft">
                Developer report
              </p>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 sm:text-xl">
                Your next candidate, in one glance.
              </h2>
              <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
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
