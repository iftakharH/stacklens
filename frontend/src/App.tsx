import { useEffect } from 'react';
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import Layout from './components/Layout';
import AnalyzePage from './pages/AnalyzePage';
import HistoryPage from './pages/HistoryPage';
import LandingPage from './pages/LandingPage';
import SavedPage from './pages/SavedPage';
import SharePage from './pages/SharePage';
import extractUsername from './lib/username';

// The analyzer is keyed on the NORMALIZED username from the URL, so:
//  - navigating /analyze?q=<profile URL> while already mounted remounts the
//    page and runs the new reading instead of ignoring the change, and
//  - the analyzer's own URL rewrite after a successful analysis (profile
//    URL → username) lands on the same key and does not remount/reanalyze.
const AnalyzeEntry = () => {
  const q = useSearchParams()[0].get('q') ?? '';
  return <AnalyzePage key={extractUsername(q) ?? q} />;
};

const ROUTE_TITLES: [RegExp, string][] = [
  [/^\/share\//, 'Shared report — StackLens'],
  [/^\/analyze/, 'Analyzer — StackLens'],
  [/^\/history/, 'Report history — StackLens'],
  [/^\/saved/, 'Saved candidates — StackLens'],
];

// Chrome that every route shares: a matching document title and a return to
// the top of the card on navigation (React Router 7 does neither by default).
function RouteChrome() {
  const location = useLocation();
  useEffect(() => {
    const hit = ROUTE_TITLES.find(([pattern]) => pattern.test(location.pathname));
    document.title = hit
      ? hit[1]
      : location.pathname === '/'
        ? 'StackLens — Read the work, not the resume'
        : 'Page not found — StackLens';
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
}

const NotFoundPage = () => (
  <main className="flex flex-1 flex-col items-center justify-center py-20 text-center">
    <p
      aria-hidden="true"
      className="num text-[clamp(2.5rem,7vw,4.5rem)] font-semibold leading-none text-line-strong"
    >
      404
    </p>
    <h2 className="display-tight mt-6 text-[clamp(1.1rem,2.4vw,1.6rem)] text-ink">
      That page doesn&apos;t exist.
    </h2>
    <p className="mt-3 max-w-[46ch] text-[13px] leading-relaxed text-muted">
      The card you asked for is not in this stack. The analyzer is where
      readings are taken.
    </p>
    <Link to="/analyze" className="btn btn-sm mt-6">
      Back to the analyzer
    </Link>
  </main>
);

// The landing page carries its own masthead and sits outside the app shell;
// the analyzer, shortlist, history and shared reports keep the app chrome.
function App() {
  return (
    <BrowserRouter>
      <RouteChrome />
      <Routes>
        <Route index element={<LandingPage />} />
        <Route element={<Layout />}>
          <Route path="analyze" element={<AnalyzeEntry />} />
          <Route path="saved" element={<SavedPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="share/:token" element={<SharePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
