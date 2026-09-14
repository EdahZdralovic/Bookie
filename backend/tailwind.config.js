/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['../frontend/views/**/*.ejs', '../frontend/src/**/*.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff8ed',
          100: '#ffefd4',
          500: '#f27a24',
          600: '#d95f12',
          700: '#b4450f',
          900: '#782f13',
        },
        ink: '#18211b',
        paper: '#f8f5ec',
      },
      boxShadow: {
        card: '0 18px 50px -24px rgba(24, 33, 27, 0.28)',
      },
    },
  },
  plugins: [],
};
