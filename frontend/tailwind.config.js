/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#e0eaff",
          500: "#2E4057",
          600: "#243347",
          700: "#1a2636",
        },
      },
    },
  },
  plugins: [],
};
