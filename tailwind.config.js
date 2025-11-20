/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./component/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./state/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
