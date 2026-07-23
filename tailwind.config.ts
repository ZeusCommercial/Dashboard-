import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B2444",        // page background — navy
        surface: "#FFFFFF",    // card background — white
        hairline: "#E2E8F0",   // borders inside white cards
        bright: "#0B2444",     // numbers & primary text in cards — navy
        muted: "#64748B",      // secondary text in cards — slate
        gold: "#F5A524",
        goldDim: "#C07F12",
        gain: "#059669",
        loss: "#DC2626",
      },
    },
  },
  plugins: [],
};
export default config;
