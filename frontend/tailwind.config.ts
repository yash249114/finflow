import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090A", // obsidian/graphite black
        surface: "#0F1012", // dark obsidian card
        border: "#1D1E22", // chrome border
        primary: {
          DEFAULT: "#6366F1", // electric indigo
          hover: "#4F46E5", // indigo-600
        },
        success: "#10B981", // emerald
        danger: "#EF4444", // red
        warning: "#F59E0B", // amber
        text: {
          primary: "#F9FAFB",
          muted: "#8E919A",
        },
        glow: "rgba(99,102,241,0.15)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(15px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        confetti: {
          "0%": { transform: "translateY(-10vh) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(360deg)", opacity: "0" },
        },
        "text-sweep": {
          "0%": { "background-position": "200% center" },
          "100%": { "background-position": "-200% center" },
        },
        "aurora-flow": {
          "0%": { transform: "translate(0%, 0%) rotate(0deg)" },
          "50%": { transform: "translate(10%, 15%) rotate(180deg)" },
          "100%": { transform: "translate(0%, 0%) rotate(360deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        confetti: "confetti 3s ease-out forwards",
        "text-sweep": "text-sweep 6s linear infinite",
        "aurora-flow": "aurora-flow 25s ease-in-out infinite alternate",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
