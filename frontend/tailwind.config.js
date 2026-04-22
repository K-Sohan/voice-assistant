/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        dark: {
          950: '#05050a',
          900: '#0b0b12',
          800: '#111119',
          700: '#18181f',
          600: '#202028',
          500: '#2a2a35',
          400: '#35353f',
        },
        violet: {
          DEFAULT: '#7c6dfa',
          hover:   '#6b5ce7',
          light:   '#9b8ffc',
          dim:     '#7c6dfa1a',
          ring:    '#7c6dfa40',
        },
        success: '#34d399',
        danger:  '#f87171',
        warn:    '#fbbf24',
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in':    'fade-in 0.3s ease-out',
        'slide-up':   'slide-up 0.4s ease-out',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%':      { opacity: '0',   transform: 'scale(1.5)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};