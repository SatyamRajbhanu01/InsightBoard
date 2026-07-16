/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#5a8cff',
          500: '#3563ff',
          600: '#2044f0',
          700: '#1a33d6',
          800: '#1b2ead',
          900: '#1c2c88',
        },
        ink: {
          900: '#0b1020',
          800: '#121a33',
          700: '#1b2545',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
