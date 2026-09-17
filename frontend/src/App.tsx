import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AnalyzePage from './pages/AnalyzePage';
import HistoryPage from './pages/HistoryPage';
import LandingPage from './pages/LandingPage';
import SavedPage from './pages/SavedPage';
import SharePage from './pages/SharePage';

const NotFoundPage = () => (
  <main className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
    <p className="font-mono text-[13px] tabular-nums text-muted">404</p>
    <h2 className="text-lg font-semibold text-ink sm:text-xl">
      That page doesn&apos;t exist.
    </h2>
    <Link
      to="/analyze"
      className="inline-flex items-center gap-1.5 rounded-[6px] border border-line px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-signal"
    >
      Back to the analyzer
    </Link>
  </main>
);

// The landing page carries its own masthead and sits outside the app shell;
// the analyzer, shortlist, history and shared reports keep the app chrome.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route element={<Layout />}>
          <Route path="analyze" element={<AnalyzePage />} />
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
