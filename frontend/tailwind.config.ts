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
        // ─── Core Palette ────────────────────────────
        background: "#060608",
        surface: {
          DEFAULT: "#0C0D10",
          elevated: "#111216",
          overlay: "#16171C",
        },
        border: {
          DEFAULT: "#1D1E24",
          subtle: "#141518",
          chrome: "#2A2B32",
        },
        // ─── Brand Colors ────────────────────────────
        primary: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
          muted: "rgba(99, 102, 241, 0.15)",
        },
        neural: {
          blue: "#6366F1",
          violet: "#8B5CF6",
          purple: "#A78BFA",
          cyan: "#06B6D4",
        },
        // ─── Metallic Accents ────────────────────────
        silver: {
          DEFAULT: "#94A3B8",
          light: "#CBD5E1",
          dark: "#64748B",
        },
        graphite: {
          DEFAULT: "#1E1F26",
          light: "#2A2B34",
          dark: "#0F1012",
        },
        // ─── Semantic Colors ─────────────────────────
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        text: {
          primary: "#F9FAFB",
          secondary: "#CBD5E1",
          muted: "#6B7280",
          dim: "#4B5563",
        },
        glow: "rgba(99,102,241,0.15)",
      },
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(15px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0px)" },
        },
        "fade-in-fast": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
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
          "0%, 100%": { opacity: "0.15" },
          "50%": { opacity: "0.4" },
        },
        "pulse-neural": {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(99, 102, 241, 0.05)",
          },
          "50%": {
            boxShadow: "0 0 40px rgba(99, 102, 241, 0.15), 0 0 80px rgba(99, 102, 241, 0.05)",
          },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "counter-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "glow-sweep": {
          "0%": { left: "-100%" },
          "100%": { left: "200%" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in-fast": "fade-in-fast 0.3s ease-out forwards",
        confetti: "confetti 3s ease-out forwards",
        "text-sweep": "text-sweep 6s linear infinite",
        "aurora-flow": "aurora-flow 25s ease-in-out infinite alternate",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        "pulse-neural": "pulse-neural 3s ease-in-out infinite",
        "float": "float 5s ease-in-out infinite",
        "counter-up": "counter-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "glow-sweep": "glow-sweep 3s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
