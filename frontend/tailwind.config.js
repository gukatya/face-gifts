/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        luxe: {
          black: "#000000",
          silver: "#DDDDDD",
          white: "#FFFFFF",
          grey: "#EBEBEB",
          "grey-mid": "#BBBBBB",
          "grey-dark": "#444444",
        },
      },
      fontFamily: {
        sans: ["TT Firs Neue", "Helvetica Neue", "Arial", "sans-serif"],
      },
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        DEFAULT: "12px",
        md: "16px",
        lg: "24px",
        xl: "40px",
      },
    },
  },
  plugins: [],
};
