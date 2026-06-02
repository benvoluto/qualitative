import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
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
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // Remap default `blue` palette to derive from the theme's primary hue (#74a7fe).
        // Keeps existing bg-blue-600 / text-blue-400 etc. components in tone with the theme.
        blue: {
          "50": "oklch(0.97 0.013 252)",
          "100": "oklch(0.94 0.025 252)",
          "200": "oklch(0.88 0.05 252)",
          "300": "oklch(0.82 0.08 252)",
          "400": "oklch(0.78 0.10 252)",
          "500": "oklch(0.747 0.119 252)",
          "600": "oklch(0.66 0.16 254)",
          "700": "oklch(0.55 0.20 258)",
          "800": "oklch(0.43 0.18 261)",
          "900": "oklch(0.32 0.13 264)",
          "950": "oklch(0.22 0.11 264)",
        },
        // True-neutral gray scale aligned to the theme's neutral oklch ladder.
        gray: {
          "50": "oklch(0.985 0 0)",
          "100": "oklch(0.97 0 0)",
          "200": "oklch(0.922 0 0)",
          "300": "oklch(0.87 0 0)",
          "400": "oklch(0.708 0 0)",
          "500": "oklch(0.556 0 0)",
          "600": "oklch(0.45 0 0)",
          "700": "oklch(0.371 0 0)",
          "800": "oklch(0.269 0 0)",
          "900": "oklch(0.205 0 0)",
          "950": "oklch(0.145 0 0)",
        },
      },
      fontFamily: {
        sans: ["var(--font-alegreya-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-pt-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-fira-code)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [typography],
} satisfies Config;
