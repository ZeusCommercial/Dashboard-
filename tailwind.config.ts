import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
     colors: {
        page: "#EEF2F7",       // light blue-gray page background
        surface: "#12294B",    // card background — dark navy
        nested: "#1B3358",     // sub-cards / tracks inside cards
        hairline: "#E2E5EA",   // 1px card border on light bg
        cardline: "#274068",   // dividers inside dark cards
        bright: "#FFFFFF",     // numbers / primary text in cards
        soft: "#E8ECF2",       // body text in cards
        muted: "#93A7C4",      // secondary text in cards
        ink: "#0B2444",        // dark text on the light page (nav, footer)
        gold: "#F5A524",
        goldDim: "#C07F12",
        gain: "#34D399",       // light green — on dark cards again
        loss: "#F87171",
      },
    },
  },
  plugins: [],
};
export default config;
