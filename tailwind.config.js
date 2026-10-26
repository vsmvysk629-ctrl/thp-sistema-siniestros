/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F8FB",
        surface: "#FFFFFF",
        subtle: "#EAF2F9",
        ink: { 900: "#22303C", 600: "#5A6B7A", 400: "#93A3B0" },
        line: "#DCE8F3",
        brand: { 700: "#16406B", 600: "#347DB2", 500: "#4A90C4", 100: "#EAF2F9" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
}
