/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#fafaf9',
        gold: '#d4af37',
        trust: {
          DEFAULT: '#142d52',
          dark: '#0a1a33',
          soft: '#e7edf7',
          line: '#2a4d82',
        },
      },
    },
  },
  plugins: [],
}
