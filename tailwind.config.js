/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                audio: {
                    base: '#050505',      // Deeper black
                    surface: '#121212',   // Panel background
                    highlight: '#1E1E1E', // Hover states
                    border: '#2A2A2A',    // Subtle borders
                    accent: '#D4AF37',    // Metallic Gold
                    text: '#E5E5E5',
                    muted: '#888888'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'glow': '0 0 20px rgba(212, 175, 55, 0.15)',
            }
        },
    },
    plugins: [],
}
