import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Cameroon flag-derived palette + neutrals (matches the demo's accent system)
        cmgreen: {
          50:  '#e8f5ed',
          100: '#c5e6cf',
          200: '#9fd6af',
          300: '#73c489',
          400: '#4ab46c',
          500: '#1ea54f',
          600: '#0e8a3f',
          700: '#006633', // Cameroon flag green
          800: '#004d26',
          900: '#062a16',
        },
        cmred:   { DEFAULT: '#ce1126' },  // Cameroon flag red
        cmyellow:{ DEFAULT: '#fcd116' },  // Cameroon flag yellow
        ink:     { DEFAULT: '#1f2937', muted: '#6b7280', faint: '#9ca3af' },
        surface: { DEFAULT: '#ffffff', sunken: '#f6f7f9', raised: '#fcfcfd' },
        border:  { DEFAULT: '#e5e7eb', strong: '#d1d5db' },
        success: { DEFAULT: '#0e8a3f', bg: '#dcfce7' },
        warning: { DEFAULT: '#b45309', bg: '#fef3c7' },
        danger:  { DEFAULT: '#b91c1c', bg: '#fee2e2' },
        info:    { DEFAULT: '#1e40af', bg: '#dbeafe' },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.06)',
        card: '0 4px 12px rgba(0,0,0,0.06)',
        lift: '0 8px 24px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};

export default config;
