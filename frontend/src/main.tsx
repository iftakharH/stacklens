import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted variable fonts (width + weight axes). Bundled locally so the app
// makes no third-party font request at runtime.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/martian-mono/wdth.css';
import './index.css';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

// Optional error tracking: enabled only when VITE_SENTRY_DSN is configured.
// The SDK is imported dynamically, so without the env var the production
// bundle never loads (or ships) Sentry code. Errors only — no router
// instrumentation, no tracing (tracesSampleRate 0).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (sentryDsn) {
  import('@sentry/react').then(({ init }) => {
    init({ dsn: sentryDsn, tracesSampleRate: 0 });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
