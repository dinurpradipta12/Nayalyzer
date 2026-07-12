/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lavender: {
          50: '#F8F5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#DDD6FE',
          400: '#C084FC',
          500: '#A855F7',
          600: '#9333EA',
          700: '#8B5CF6',
          800: '#7C3AED',
          900: '#6D28D9',
        },
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #C084FC 100%)',
        'purple-gradient-soft': 'linear-gradient(135deg, #EDE9FE 0%, #F3E8FF 100%)',
        'card-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 50%, #C084FC 100%)',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(139, 92, 246, 0.1), 0 4px 6px -2px rgba(139, 92, 246, 0.05)',
        'card': '0 4px 20px -2px rgba(139, 92, 246, 0.08)',
        'purple': '0 4px 20px -2px rgba(139, 92, 246, 0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
