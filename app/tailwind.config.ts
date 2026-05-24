import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // v3 — bright editorial palette
        ink: {
          DEFAULT: '#0c1220',
          2: '#1f2937',
          3: '#475569',
          4: '#64748b',
          5: '#94a3b8',
        },
        line: {
          DEFAULT: '#e5e9ee',
          2: '#d4dae2',
        },
        surface: {
          DEFAULT: '#ffffff',
          2: '#f5f6f8',
          3: '#eef1f4',
        },
        bgsoft: '#fafafa',
        obsidian: '#0c1220',
        // Brand
        cmgreen: {
          50:  '#e6f5ed',
          600: '#0aa052',
          700: '#00873f',
          800: '#006b3a',
          900: '#003e25',
        },
        cmred:    { DEFAULT: '#b03b3b', 50: '#fdeaea' },
        cmyellow: { DEFAULT: '#fcd116' },
        gold: {
          50:  '#fbf5e6',
          200: '#f0e1b8',
          500: '#d6b15e',
          600: '#c1973f',
          700: '#a47e2c',
        },
        // Status (v3, brighter & clearer)
        statePend:   { bg: '#fef3c7', fg: '#92510e' },
        stateRev:    { bg: '#e0ecff', fg: '#1d4ed8' },
        stateSign:   { bg: '#d4f4dd', fg: '#086a3c' },
        stateRej:    { bg: '#fde4e4', fg: '#a82626' },
        stateClosed: { bg: '#e5e9ee', fg: '#475569' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(12, 18, 32, 0.06)',
        card: '0 4px 12px rgba(12, 18, 32, 0.06)',
        lift: '0 12px 32px -8px rgba(12, 18, 32, 0.12)',
      },
      letterSpacing: {
        widest: '0.2em',
      },
    },
  },
  plugins: [],
};

export default config;
