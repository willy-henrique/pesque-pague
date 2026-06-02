import type { Config } from "tailwindcss";

// Tailwind v4: theme config lives in globals.css via @theme directive.
// This file is intentionally minimal — kept only for tooling compatibility.
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
