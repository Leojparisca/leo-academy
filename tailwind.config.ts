import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        abyss: "var(--bg-abyss)",
        sapphire: {
          surface: "var(--bg-sapphire-surface)",
          elevated: "var(--bg-sapphire-elevated)",
        },
        royal: "var(--accent-royal)",
        glow: "var(--accent-cyan-glow)",
        ivory: "var(--text-ivory)",
        muted: "var(--text-muted)",
        faint: "var(--text-faint)",
        ember: "var(--accent-ember)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Iowan Old Style", "Palatino", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        neu: "24px",
        "neu-lg": "32px",
      },
      boxShadow: {
        deep: "8px 8px 18px #03070D, -6px -6px 16px rgba(30, 95, 180, 0.12)",
        "deep-sm":
          "5px 5px 12px #03070D, -4px -4px 10px rgba(30, 95, 180, 0.1)",
        inset:
          "inset 5px 5px 12px #03070D, inset -4px -4px 10px rgba(30, 95, 180, 0.12)",
        glow: "0 0 28px rgba(56, 189, 248, 0.18)",
      },
      transitionTimingFunction: {
        silk: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "slow-drift": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(10px,-14px,0) scale(1.06)" },
        },
        "ember-flicker": {
          "0%, 100%": { opacity: "0.8", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
        "sheen-pass": {
          "0%": { transform: "translateX(-120%) skewX(-18deg)", opacity: "0" },
          "20%": { opacity: "0.4" },
          "100%": { transform: "translateX(220%) skewX(-18deg)", opacity: "0" },
        },
        "dot-pulse": {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.9)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "slow-drift": "slow-drift 16s ease-in-out infinite",
        "ember-flicker": "ember-flicker 2.8s ease-in-out infinite",
        "sheen-pass": "sheen-pass 1.1s ease-out",
        "dot-pulse": "dot-pulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
