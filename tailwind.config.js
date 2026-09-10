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
          50: "#f6f1fe",
          100: "#ece4fd",
          200: "#d9cbfb",
          300: "#bda3f7",
          400: "#9e74f0",
          500: "#8149e8",
          600: "#6d2cdc",
          700: "#5d1fc8",
          800: "#4d1aa6",
          900: "#3f1686",
          950: "#2a0f5c"
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
