import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"

const oklchVar = (name: string): string => `oklch(var(${name}) / <alpha-value>)`

const config = {
  darkMode: ["class"],
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        border: oklchVar("--border"),
        input: oklchVar("--input"),
        ring: oklchVar("--ring"),
        background: oklchVar("--background"),
        foreground: oklchVar("--foreground"),
        primary: {
          DEFAULT: oklchVar("--primary"),
          foreground: oklchVar("--primary-foreground"),
        },
        secondary: {
          DEFAULT: oklchVar("--secondary"),
          foreground: oklchVar("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: oklchVar("--destructive"),
          foreground: oklchVar("--destructive-foreground"),
        },
        muted: {
          DEFAULT: oklchVar("--muted"),
          foreground: oklchVar("--muted-foreground"),
        },
        accent: {
          DEFAULT: oklchVar("--accent"),
          foreground: oklchVar("--accent-foreground"),
        },
        popover: {
          DEFAULT: oklchVar("--popover"),
          foreground: oklchVar("--popover-foreground"),
        },
        card: {
          DEFAULT: oklchVar("--card"),
          foreground: oklchVar("--card-foreground"),
        },
        "chart-1": oklchVar("--chart-1"),
        "chart-2": oklchVar("--chart-2"),
        "chart-3": oklchVar("--chart-3"),
        "chart-4": oklchVar("--chart-4"),
        "chart-5": oklchVar("--chart-5"),
        sidebar: {
          DEFAULT: oklchVar("--sidebar"),
          foreground: oklchVar("--sidebar-foreground"),
          primary: oklchVar("--sidebar-primary"),
          "primary-foreground": oklchVar("--sidebar-primary-foreground"),
          accent: oklchVar("--sidebar-accent"),
          "accent-foreground": oklchVar("--sidebar-accent-foreground"),
          border: oklchVar("--sidebar-border"),
          ring: oklchVar("--sidebar-ring"),
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
      },
      letterSpacing: {
        tighter: "-0.02em",
      },
    },
  },
  plugins: [animate],
} satisfies Config

export default config
