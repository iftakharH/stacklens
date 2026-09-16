/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy app palette (report pages). Kept so existing pages keep working.
        primary: {
          DEFAULT: '#7C3AED',
          soft: '#A855F7',
          subtle: '#EDE9FE',
          dark: '#5B21B6',
        },
        surface: {
          DEFAULT: '#0F172A',
          alt: '#020617',
          light: '#F9FAFB',
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
