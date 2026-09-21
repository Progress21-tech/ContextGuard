/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#102a2b",
          muted: "#617879",
          line: "#dce8e5",
          paper: "#f7faf8",
          mint: "#b8efca",
          green: "#14735f",
          red: "#bf414a",
          amber: "#b96c19",
          nav: "#102f30"
        }
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
