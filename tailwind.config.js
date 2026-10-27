/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F3F5F8",
        surface: "#FFFFFF",
        subtle: "#F6F8FA",
        ink: { 900: "#16202E", 600: "#5B6676", 400: "#8A94A3" },
        line: { DEFAULT: "#E1E6ED", strong: "#CBD3DD", soft: "#EEF1F5" },
        navy: { 900: "#1F3B63", 800: "#2A4A75", 600: "#3B5F8F", 200: "#C9D4E3" },
        tone: {
          blueBg: "#E3ECF8", blue: "#1E4E8C",
          orangeBg: "#FDEBD6", orange: "#8A3B07",
          greenBg: "#DDF1E6", green: "#17603A",
          grayBg: "#ECEEF1", gray: "#4A5361",
          redBg: "#FBE1E1", red: "#9B1C1C",
        },
        sev: { alta: "#B42318", media: "#B45309", baja: "#2F6FB5" },
      },
      borderRadius: { card: "14px" },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
}
