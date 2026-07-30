/** @type {import('tailwindcss').Config} */

/* NOTE: the prototype components in app/components/ style themselves with
   inline styles + the CSS custom properties in app/globals.css, not Tailwind
   utilities. This config maps those same tokens onto Tailwind so new work can
   use utilities without introducing a second, competing palette. */

module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        raised: 'var(--bg-raised)',
        elevated: 'var(--bg-elevated)',
        inset: 'var(--bg-inset)',
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          press: 'var(--brand-press)',
          text: 'var(--brand-text)',
          surface: 'var(--brand-surface)',
          border: 'var(--brand-border)',
        },
        ink: {
          900: 'var(--text-900)',
          700: 'var(--text-700)',
          500: 'var(--text-500)',
          400: 'var(--text-400)',
        },
        up: 'var(--up-500)',
        down: 'var(--down-500)',
        info: 'var(--info-500)',
        warning: 'var(--warning-500)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        soft: 'var(--border-soft)',
        strong: 'var(--border-strong)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        1: 'var(--shadow-1)',
        3: 'var(--shadow-3)',
        brand: 'var(--glow-brand)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
    },
  },
  plugins: [],
};
