/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, matte hi-fi chassis palette — replaces the old flat black/gold theme.
        // Same token names as before so untouched files keep working.
        'audio-base': '#101214',       // matte chassis black (warm, not pure #000)
        'audio-surface': '#1b1e21',    // panel surface
        'audio-highlight': '#252c28',  // hover / active panel
        'audio-border': '#303833',     // hairline separators
        'audio-accent': '#b4e4bd',     // brushed brass — primary accent
        'audio-accent-bright': '#c9f3d0', // hover / active brass glow
        'audio-accent-soft': '#71947c',
        'audio-text': '#edf0ec',       // VU-meter cream — primary text
        'audio-muted': '#9ca5a6',      // warm muted gray-brown
        'audio-signal': '#83bfa5',     // phosphor teal — "verified / live" signal color
        'audio-led': '#a1d8b1',        // healthy phosphor LED
        'audio-warn': '#e6a18b',       // analog needle red-orange — peaks / destructive
        'audio-led-red': '#eb9689',     // fault / error LED
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
