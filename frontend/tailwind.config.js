/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
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

