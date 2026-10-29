/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./demo/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F8FA",
        surface: "#FFFFFF",
        subtle: "#F3F4F6",
        ink: { 900: "#0B0F17", 600: "#5B6270", 400: "#9AA1AD" },
        line: { DEFAULT: "#E8EAEE", strong: "#D5D9DF", soft: "#F0F1F4" },
        // Primario: tinta casi negra. Acento: azul del logo THP.
        navy: { 900: "#0B0F17", 800: "#1F2530", 600: "#2B74AE", 200: "#C9D4E3" },
        thp: { DEFAULT: "#2B74AE", dark: "#1F5F93", soft: "#EEF4FA", gris: "#9A9A9A" },
        tone: {
          blueBg: "#EEF4FA", blue: "#1F5F93",
          orangeBg: "#FBF2E8", orange: "#8A4B12",
          greenBg: "#EAF5EF", green: "#1F6B45",
          grayBg: "#F1F2F4", gray: "#4B5361",
          redBg: "#FBEDED", red: "#A12828",
        },
        sev: { alta: "#D14343", media: "#D98A2B", baja: "#2B74AE" },
      },
      borderRadius: { card: "14px" },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
        display: ['"Montserrat"', '"Inter"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        flota: "0 1px 2px rgba(11,15,23,0.04), 0 8px 24px -12px rgba(11,15,23,0.10)",
      },
    },
  },
}
