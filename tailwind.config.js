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
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};
