const colors = require('tailwindcss/colors');

module.exports = {
  purge: ['./public/index.html', './public/js/script.js'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        primary: colors.lightBlue,
        gray: colors.trueGray,
      },
      fontFamily: {
        inter: ['inter', 'sans-serif'],
      },
      maxHeight: {
        none: 'none',
      },
    },
  },
  variants: {
    extend: {
      backgroundColor: ['odd'],
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
