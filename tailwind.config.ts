import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:      "#0A1628",
        surface:  "#0F1F35",
        raised:   "#152943",
        hairline: "#1E3A5C",
        muted:    "#7B93B4",
        bright:   "#E8F0FA",
        gold:     "#F5A623",
        goldDim:  "#B87D14",
        gain:     "#34D399",
        loss:     "#F87171",
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
