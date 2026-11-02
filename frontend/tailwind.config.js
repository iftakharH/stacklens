/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Signal Calibration tokens. Every value flips with the `.dark` class
        // through CSS variables (see src/index.css), so do NOT use Tailwind
        // opacity modifiers on them (e.g. bg-field/70) — the vars are plain
        // `var()` strings that cannot be split into channels.
        field: 'var(--field)',
        'field-deep': 'var(--field-deep)',
        plate: 'var(--plate)',
        'plate-raised': 'var(--plate-raised)',
        ink: 'var(--ink)',
        ink2: 'var(--ink-2)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        signal: 'var(--signal)',
        'signal-soft': 'var(--signal-soft)',
        'signal-ink': 'var(--signal-ink)',
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        'danger-ink': 'var(--danger-ink)',

        // Legacy aliases kept so an unreached class still resolves to the
        // current palette instead of the retired violet scale.
        paper: 'var(--field)',
        panel: 'var(--plate)',
        primary: {
          DEFAULT: 'var(--signal)',
          soft: 'var(--signal)',
          subtle: 'var(--field)',
          dark: 'var(--signal)',
        },
        surface: {
          DEFAULT: 'var(--plate)',
          alt: 'var(--field)',
          light: 'var(--plate)',
        },
      },
      fontFamily: {
        // One grotesque in two widths (display uses font-stretch), plus a
        // readout mono reserved for measured values. Both self-hosted via
        // @fontsource-variable (see src/main.tsx).
        sans: ['"Archivo Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          '"Martian Mono Variable"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.45' }],
      },
      letterSpacing: {
        rail: '0.16em',
        plate: '0.07em',
      },
      maxWidth: {
        measure: '68ch',
      },
      boxShadow: {
        soft: 'var(--plate-shadow)',
      },
      borderRadius: {
        // This world is set square. The scale exists so an accidental
        // `rounded-xl` resolves to a hairline rather than a pill.
        xl: '0',
        '2xl': '0',
      },
    },
  },
  plugins: [],
};
