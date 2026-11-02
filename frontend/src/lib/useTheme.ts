import { useEffect, useState } from 'react';

const THEME_KEY = 'stacklens-theme';

// Theme state shared by the landing page and the app shell.
// Rules:
//  - The OS preference ("system") is the default; it is NEVER written to
//    localStorage just for visiting, so changing the OS theme keeps working.
//  - The moment the user toggles, the explicit choice is persisted (and wins
//    from then on) — exactly what index.html's pre-paint script reads.
//  - While in system mode, live matchMedia changes are followed.
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Null while following the system, 'light' | 'dark' once the user chose.
  const [userPref, setUserPref] = useState<'light' | 'dark' | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(THEME_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  });

  // Follow OS changes only while the visitor has not expressed a choice.
  useEffect(() => {
    if (userPref) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [userPref]);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (userPref) {
      localStorage.setItem(THEME_KEY, userPref);
    }
  }, [dark, userPref]);

  const setDarkState = (next: boolean) => {
    setUserPref(next ? 'dark' : 'light');
    setDark(next);
  };
  const toggle = () => {
    setDarkState(!dark);
  };

  return { dark, toggle };
}
