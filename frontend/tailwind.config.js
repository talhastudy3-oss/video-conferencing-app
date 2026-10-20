/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          300: '#9cb8fb',
          400: '#6b93f9',
          500: '#3b6ef6',
          600: '#2c56d6',
          700: '#2244ab',
        },
      },
    },
  },
  plugins: [],
};
