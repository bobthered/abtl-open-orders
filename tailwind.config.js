const colors = require('tailwindcss/colors');

module.exports = {
  purge: ['./views/**/**.ejs', './public/js/script.js', './src/css/**/**.css'],
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
