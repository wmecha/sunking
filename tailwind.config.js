/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sun-yellow': '#F5C000',
        'sun-yellow-hover': '#D4A800',
        'sun-dark': '#1C2B3A',
        'sun-charcoal': '#374151',
        'sun-light': '#F9FAFB',
        'sun-white': '#FFFFFF',
        'sun-border': '#E5E7EB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
