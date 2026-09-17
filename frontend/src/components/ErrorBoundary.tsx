import { Component, type ErrorInfo, type ReactNode } from 'react';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean; message: string };

// A render-time error must never surface as a blank page. This boundary
// catches anything a routed page throws while rendering and shows a readable,
// token-styled fallback plus a Reload button. Module-evaluation failures
// (e.g. a bad auth base URL) are handled at their source, not here.
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (sentryDsn) {
      import('@sentry/react')
        .then(({ captureException }) => {
          captureException(error, {
            extra: { componentStack: info.componentStack },
          });
        })
        .catch(() => {
          // Telemetry failures must never mask the render error.
        });
    }
    console.error('StackLens render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center text-ink">
        <p className="text-[15px] font-semibold text-ink">
          Something broke while rendering this page.
        </p>
        <p className="max-w-[52ch] text-[13px] leading-relaxed text-muted">
          Reload to try again. If it keeps happening, the problem is on our side
          — nothing you did caused it.
        </p>
        {this.state.message && (
          <p className="max-w-[72ch] break-words font-mono text-[11px] text-muted">
            {this.state.message}
          </p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 h-11 rounded-[6px] bg-signal px-5 text-[14px] font-semibold text-signal-ink transition-opacity hover:opacity-90"
        >
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
