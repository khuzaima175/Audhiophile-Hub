/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, matte hi-fi chassis palette — replaces the old flat black/gold theme.
        // Same token names as before so untouched files keep working.
        'audio-base': '#0F0C0A',       // matte chassis black (warm, not pure #000)
        'audio-surface': '#1A1512',    // panel surface
        'audio-highlight': '#231D18',  // hover / active panel
        'audio-border': '#332B23',     // hairline separators
        'audio-accent': '#C6934F',     // brushed brass — primary accent
        'audio-accent-bright': '#E7B87A', // hover / active brass glow
        'audio-accent-soft': '#8A6A3E',
        'audio-text': '#EDE6DA',       // VU-meter cream — primary text
        'audio-muted': '#9C8F7D',      // warm muted gray-brown
        'audio-signal': '#6FC9A6',     // phosphor teal — "verified / live" signal color
        'audio-led': '#7FD8B4',        // healthy phosphor LED
        'audio-warn': '#D97748',       // analog needle red-orange — peaks / destructive
        'audio-led-red': '#E06A3F',     // fault / error LED
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
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
        'panel': 'inset 0 1px 0 rgba(237,230,218,0.05), 0 12px 32px rgba(0,0,0,0.45)',
        'glow-brass': '0 0 14px rgba(198,147,79,0.28)',
        'glow-teal': '0 0 12px rgba(111,201,166,0.30)',
        'glow-red': '0 0 12px rgba(224,106,63,0.35)',
      },
    },
  },
  plugins: [],
};
