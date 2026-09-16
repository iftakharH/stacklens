import { useEffect, useState } from 'react';

const THEME_KEY = 'stacklens-theme';

// Theme state shared by the landing page and the app shell. Persists the
// choice in localStorage and mirrors it onto <html class="dark">.
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [dark]);

  return { dark, toggle: () => setDark((value) => !value) };
}
