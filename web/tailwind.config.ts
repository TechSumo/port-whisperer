import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{vue,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Every surface is monospace in the Matrix Console aesthetic.
        // `sans` and `mono` both resolve to JetBrains Mono so Tailwind
        // utilities like `font-sans` don't escape the terminal feel.
        sans: [
          '"JetBrains Mono Variable"',
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
        mono: [
          '"JetBrains Mono Variable"',
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        "bg-elevated": "rgb(var(--bg-elevated) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        "fg-muted": "rgb(var(--fg-muted) / <alpha-value>)",
        "fg-subtle": "rgb(var(--fg-subtle) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-hover": "rgb(var(--border-hover) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        healthy: "rgb(var(--healthy) / <alpha-value>)",
        orphan: "rgb(var(--orphan) / <alpha-value>)",
        zombie: "rgb(var(--zombie) / <alpha-value>)",
      },
      animation: {
        "fade-up": "fadeUp 480ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "pulse-dot":
          "pulseDot 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flash-new": "flashNew 2s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
        },
        flashNew: {
          "0%": { backgroundColor: "rgb(var(--accent) / 0.22)" },
          "100%": { backgroundColor: "rgb(var(--accent) / 0)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
