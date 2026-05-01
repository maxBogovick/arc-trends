/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      colors: {
        lumio: {
          bg: '#F5F3FF',
          card: 'rgba(255,255,255,0.75)',
          purple: '#7C3AED',
          'purple-light': '#A78BFA',
          pink: '#EC4899',
          blue: '#3B82F6',
          green: '#10B981',
          yellow: '#F59E0B',
          red: '#EF4444',
          text: '#1E1147',
          muted: '#6B7280',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(124, 58, 237, 0.12)',
        'glass-lg': '0 16px 48px rgba(124, 58, 237, 0.18)',
        glow: '0 0 20px rgba(167, 139, 250, 0.5)',
        'glow-pink': '0 0 20px rgba(236, 72, 153, 0.4)',
      },
      backdropBlur: { xs: '2px' },
      animation: {
        float: 'float 3s ease-in-out infinite',
        blink: 'blink 4s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.4s ease-out forwards',
        'slide-down': 'slide-down 0.3s ease-in forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        blink: {
          '0%, 90%, 100%': { transform: 'scaleY(1)' },
          '95%': { transform: 'scaleY(0.05)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(0.97)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '1', transform: 'translateY(0)' },
          to: { opacity: '0', transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}
