/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#06060e',
          panel: '#0a0a1a',
          card: '#111122',
        },
        border: {
          DEFAULT: '#1a1a3a',
          hover: '#2a2a5a',
        },
        accent: {
          DEFAULT: '#5599ff',
          glow: 'rgba(85, 153, 255, 0.3)',
        },
        danger: '#ff4444',
        success: '#55ff55',
        warning: '#ffdd55',
        cyan: '#00ffff',
        magenta: '#ff00ff',
        gold: '#ffd700',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
