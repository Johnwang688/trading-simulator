import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#08080f",
          secondary: "#0e0e1a",
          tertiary: "#151525",
          card: "#12121f",
        },
        accent: {
          cyan: "#00d4ff",
          blue: "#0088ff",
        },
        profit: "#00ff88",
        loss: "#ff3366",
        neutral: "#8888aa",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
