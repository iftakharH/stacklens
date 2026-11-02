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
      <div className="ground flex min-h-screen items-center justify-center px-5">
        <div className="frame relative w-full max-w-[560px] p-6 sm:p-8">
          <p className="rail text-danger">Card fault · render</p>
          <p className="display-tight mt-3 text-[1.1rem] text-ink">
            Something broke while rendering this page.
          </p>
          <p className="mt-3 max-w-[52ch] text-[13px] leading-relaxed text-muted">
            Reload to try again. If it keeps happening, the problem is on our
            side — nothing you did caused it.
          </p>
          {this.state.message && (
            <p className="num mt-4 break-words border border-line bg-field-deep px-3 py-2 text-[11px] text-muted">
              {this.state.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-5 h-11"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
