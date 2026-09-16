import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AnalyzePage from './pages/AnalyzePage';
import HistoryPage from './pages/HistoryPage';
import SavedPage from './pages/SavedPage';
import SharePage from './pages/SharePage';

const NotFoundPage = () => (
  <main className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
    <p className="text-xs font-semibold uppercase tracking-widest text-primary dark:text-primary-soft">
      404
    </p>
    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 sm:text-xl">
      That page doesn&apos;t exist.
    </h2>
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 dark:border-primary-soft/40 dark:bg-primary-soft/10 dark:text-primary-soft dark:hover:bg-primary-soft/20"
    >
      Back to analyzing →
    </Link>
  </main>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<AnalyzePage />} />
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
