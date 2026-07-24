import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
     colors: {
        page: "#061426",       // deep navy page
        surface: "#12294B",    // cards — one step lighter
        hairline: "#1E3A5F",   // card border — visible against #061426
        ink: "#E8ECF2",        // text on the page (nav, footer) — now LIGHT
        nested: "#1B3358",     // sub-cards / tracks inside cards
        cardline: "#274068",   // dividers inside dark cards
        bright: "#FFFFFF",     // numbers / primary text in cards
        soft: "#E8ECF2",       // body text in cards
        muted: "#93A7C4",      // secondary text in cards
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
