/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy `primary` scale now points at the landing-page signal token
        // (see src/index.css). Safety net only: a missed legacy class resolves
        // to the theme-aware teal instead of the retired violet gradient.
        primary: {
          DEFAULT: 'var(--signal)',
          soft: 'var(--signal)',
          subtle: 'var(--paper)',
          dark: 'var(--signal)',
        },
        surface: {
          DEFAULT: 'var(--panel)',
          alt: 'var(--paper)',
          light: 'var(--panel)',
        },
        // Landing-page tokens. Values flip with the `.dark` class via CSS vars
        // (see src/index.css). They are plain `var()` strings, so do not use
        // Tailwind opacity modifiers (e.g. bg-paper/70) on them.
        paper: 'var(--paper)',
        panel: 'var(--panel)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        signal: 'var(--signal)',
        'signal-ink': 'var(--signal-ink)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        // One grotesque in two widths (display uses font-stretch via .display),
        // plus a readout mono reserved for measured values. Both self-hosted
        // via @fontsource-variable (see src/main.tsx).
        sans: ['"Archivo Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          '"Martian Mono Variable"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.25)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
