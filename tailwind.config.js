/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        accent: 'var(--c-accent)',
        accent2: 'var(--c-accent-2)',
        ink: 'var(--c-ink)',
        inkdim: 'var(--c-ink-dim)',
      },
      fontFamily: {
        display: '"Segoe UI Variable Display", "Segoe UI", "SF Pro Display", system-ui, sans-serif',
        body: '"Segoe UI Variable Text", "Segoe UI", "SF Pro Text", system-ui, sans-serif',
      },
      transitionTimingFunction: {
        silk: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
