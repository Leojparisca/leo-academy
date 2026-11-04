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
        canvas: "#060911",
        panel: "#0E1524",
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
        gold: "var(--accent-gold)",
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
        deep: "0 22px 44px -30px rgba(0,0,0,0.95)",
        "deep-sm": "0 14px 28px -20px rgba(0,0,0,0.9)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.06)",
        glow: "0 0 28px rgba(56, 189, 248, 0.18)",
        float: "0 24px 48px -20px rgba(0, 0, 0, 0.9)",
        sapphire: "0 16px 32px -14px rgba(13, 110, 253, 0.7)",
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
