/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /** Page background. Was hardcoded as `bg-[#050508]` in 20 places. */
        ink: "#050508",
        /** Slightly lifted surface, used for alternating page sections. */
        "ink-raised": "#0a0a11",
        brand: {
          DEFAULT: "#a855f7",
          pink: "#ff2d95",
          cyan: "#00f0ff",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      // Tailwind already ships `animate-pulse` with identical keyframes; the old
      // config shadowed it. Only the custom `float` remains.
      animation: {
        float: "float 6s ease-in-out infinite",
        // Simon: lit for most of the 1s tick, then dims so repeats read as two flashes.
        "simon-flash": "simon-flash 1s ease-out forwards",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "simon-flash": {
          "0%": { opacity: "0.25", transform: "scale(0.96)" },
          "8%, 70%": { opacity: "1", transform: "scale(1.05)" },
          "100%": { opacity: "0.25", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
