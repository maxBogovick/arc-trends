/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          50: '#f7f7f8',
          100: '#2c2c2e',
          200: '#252527',
          300: '#1e1e20',
          400: '#18181a',
          500: '#111113',
        },
        accent: {
          DEFAULT: '#7c5cfc',
          hover: '#6b4beb',
          light: '#a78bfa',
          muted: 'rgba(124,92,252,0.15)',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.16)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
