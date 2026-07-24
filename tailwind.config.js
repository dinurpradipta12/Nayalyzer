/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        violet: {
          50: '#EAF5F4',
          100: '#D3EAE8',
          200: '#A8D5D1',
          300: '#7DBDB9',
          400: '#3F9995',
          500: '#187877',
          600: '#126B73',
          700: '#0F5668',
          800: '#0B3F5C',
          900: '#0B2A50',
        },
        purple: {
          50: '#EAF5F4',
          100: '#D3EAE8',
          200: '#A8D5D1',
          300: '#7DBDB9',
          400: '#3F9995',
          500: '#187877',
          600: '#126B73',
          700: '#0F5668',
          800: '#0B3F5C',
          900: '#0B2A50',
        },
        lavender: {
          50: '#F0FAFA',
          100: '#EAF5F4',
          200: '#D3EAE8',
          300: '#A8D5D1',
          400: '#7DBDB9',
          500: '#187877',
          600: '#126B73',
          700: '#0F5668',
          800: '#0B3F5C',
          900: '#0B2A50',
        },
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #187877 0%, #0B2A50 100%)',
        'purple-gradient-soft': 'linear-gradient(135deg, #F0FAFA 0%, #EAF5F4 100%)',
        'card-gradient': 'linear-gradient(135deg, #187877 0%, #126B73 50%, #0B2A50 100%)',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(24, 120, 119, 0.1), 0 4px 6px -2px rgba(11, 42, 80, 0.05)',
        'card': '0 4px 20px -2px rgba(24, 120, 119, 0.08)',
        'purple': '0 4px 20px -2px rgba(24, 120, 119, 0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
