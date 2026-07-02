/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "12px",
        lg: "16px",
        xl: "20px",
      },
      colors: {
        border: "#ECECEC",
        surface: "#FAFAFA",
        muted: "#71717A",
        "border-dark": "#2A2A2E",
        "surface-dark": "#18181B",
        "muted-dark": "#A1A1AA",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.02), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        dropdown: "0 10px 15px -3px rgb(0 0 0 / 0.04), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
        modal: "0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.04)",
      },
    },
  },
  plugins: [],
}
