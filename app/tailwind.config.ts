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
        // transparent so page <main> wrappers reveal the fixed aurora backdrop
        bgsoft: 'transparent',
        obsidian: '#0c1220',
        // V3 Aurora Glass — blue/cyan primary scale (from the IPA logo navy)
        navy: '#10355c',
        blue: {
          50:  '#eef5fc',
          100: '#d8e9f7',
          200: '#b3d1ee',
          300: '#83b6e6',
          400: '#52a8ec',
          500: '#3a8fd8',
          600: '#2b7ec9',
          700: '#246aad',
          800: '#1c5085',
          900: '#10355c',
        },
        cyan: { DEFAULT: '#39c0d6', 400: '#39c0d6', 600: '#2298ab' },
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
        display: ['var(--font-display)', 'Lexend', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(12, 18, 32, 0.06)',
        card: '0 4px 12px rgba(12, 18, 32, 0.06)',
        lift: '0 12px 32px -8px rgba(12, 18, 32, 0.12)',
        glass: '0 2px 6px rgba(16, 53, 92, 0.06), 0 20px 50px rgba(16, 53, 92, 0.14)',
      },
      letterSpacing: {
        widest: '0.2em',
      },
    },
  },
  plugins: [],
};

export default config;
