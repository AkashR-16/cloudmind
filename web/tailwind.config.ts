import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#dce6ff",
          200: "#b8ccff",
          400: "#6b8df9",
          500: "#4f6ef7",
          600: "#3b55e6",
          700: "#2d42c9",
          900: "#1a2580",
        },
        surface: {
          DEFAULT: "#0c0e18",
          card:   "#111420",
          border: "#1e2235",
          muted:  "#252a3d",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "brand-glow": "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(79,110,247,0.15), transparent)",
      },
      boxShadow: {
        glow:    "0 0 0 1px rgba(79,110,247,0.1), 0 4px 32px -4px rgba(0,0,0,0.5)",
        "glow-brand": "0 0 32px -8px rgba(79,110,247,0.45)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in":    "fadeIn 0.3s ease-in-out",
        "slide-up":   "slideUp 0.25s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
        shimmer:  "shimmer 2s infinite",
        float:    "float 4s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        typing:   "typing 1.2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        slideInRight: {
          "0%":   { transform: "translateX(12px)", opacity: "0" },
          "100%": { transform: "translateX(0)",    opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%":     { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%":    { transform: "scale(0.95)", opacity: "0.8" },
          "70%":   { transform: "scale(1.1)",  opacity: "0"   },
          "100%":  { transform: "scale(0.95)", opacity: "0"   },
        },
        typing: {
          "0%,60%,100%": { transform: "translateY(0)",   opacity: "0.4" },
          "30%":          { transform: "translateY(-4px)", opacity: "1"   },
        },
      },
    },
  },
  plugins: [],
};

export default config;
