import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  // App is locked to dark theme — `dark:` variants always apply because the
  // `<html>` element carries the `dark` class in layout.tsx. Switching back to
  // media-driven theming would require removing that class.
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["'Lab Grotesque'", "Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [typography],
} satisfies Config;
