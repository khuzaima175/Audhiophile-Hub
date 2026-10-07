/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'audio-base': 'var(--base)',
        'audio-surface': 'var(--surface)',
        'audio-highlight': 'var(--highlight)',
        'audio-border': 'var(--border)',
        'audio-accent': 'var(--accent)',
        'audio-accent-bright': 'var(--text)',
        'audio-accent-soft': 'var(--muted)',
        'audio-text': 'var(--text)',
        'audio-muted': 'var(--muted)',
        'audio-signal': 'var(--signal)',
        'audio-led': 'var(--signal)',
        'audio-warn': 'var(--warn)',
        'audio-led-red': '#eb9689',
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      keyframes: {
        'meter-bar': {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'needle-sweep': {
          '0%': { transform: 'rotate(-18deg)' },
          '50%': { transform: 'rotate(18deg)' },
          '100%': { transform: 'rotate(-18deg)' },
        },
        'led-breathe': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'meter-bar': 'meter-bar 1.1s ease-in-out infinite',
        'needle-sweep': 'needle-sweep 2.4s ease-in-out infinite',
        'led-pulse': 'led-breathe 2.4s ease-in-out infinite',
      },
      boxShadow: {
        'panel': '0 4px 16px rgba(0,0,0,0.12)',
        'glow-brass': 'none',
        'glow-teal': 'none',
        'glow-red': 'none',
      },
    },
  },
  plugins: [],
};
