/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#faf5fc",
          100: "#f3e6f7",
          200: "#e5c9ee",
          300: "#d19fdd",
          400: "#b266d4",
          500: "#a04fd6",
          600: "#800080",
          700: "#660066",
          800: "#4d004d",
          900: "#3a003a",
          950: "#2a002a"
        },
        ink: {
          900: "#140a1f"
        },
        danger: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626"
        },
        warn: {
          400: "#fbbf24",
          500: "#f59e0b"
        },
        success: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
