import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // page background is now white (set in globals.css / layout)
        surface: "#0B2444",        // card background (dark navy)
        ink: "#08192F",            // darker track inside cards (bar backgrounds)
        hairline: "#1E3A5F",       // card borders — visible on white
        bright: "#FFFFFF",         // big numbers / primary text in cards
        muted: "#9FB3CC",          // secondary text inside dark cards
        gold: "#F5A524",           // headings + accents
        goldDim: "#C07F12",
        gain: "#34D399",
        loss: "#F87171",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
