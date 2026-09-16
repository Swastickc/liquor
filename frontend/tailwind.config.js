/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#fc8019",
        secondary: "#f8f8f8",

        // Swiggy design system
        swiggy: {
          orange: "#FC8019",
          "orange-light": "#FF9A40",
          "orange-dim": "#E06800",
          charcoal: "#282C3F",
          yellow: "#F3C334",
          "yellow-light": "#FDE68A",
          surface: "#FFFFFF",
          muted: "#686B78",
          border: "#E9EAEC",
          "border-light": "#F0F0F0",
          success: "#48C479",
          danger: "#E0364A",
        },

        // Legacy aliases
        background:        "#ffffff",
        surface:           "#ffffff",
        "surface-raised":  "#f8f8f8",
        foreground:        "#282C3F",
        muted:             "#f8f8f8",
        "muted-foreground":"#686B78",
        accent:            "#FC8019",
        "accent-light":    "#FF9A40",
        "accent-dim":      "#E06800",
        "accent-yellow":   "#F3C334",
        border:            "#E9EAEC",
        "border-subtle":   "#F0F0F0",
        card:              "#ffffff",
        success:           "#48C479",
        danger:            "#E0364A",
        warning:           "#F3C334",
        info:              "#5D8ED5",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        sans:    ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "orange-gradient": "linear-gradient(135deg, #FC8019 0%, #F3C334 100%)",
        "orange-gradient-h": "linear-gradient(90deg, #FC8019 0%, #F3C334 100%)",
        "charcoal-gradient": "linear-gradient(180deg, #282C3F 0%, #1A1E2E 100%)",
      },
      boxShadow: {
        card:       "0 2px 8px rgba(40,44,63,0.06)",
        "card-hover":"0 8px 24px rgba(40,44,63,0.12)",
        float:      "0 12px 32px rgba(40,44,63,0.15)",
        hard:       "4px 4px 0px rgba(40,44,63,0.08)",
        "hard-sm":  "2px 2px 0px rgba(40,44,63,0.06)",
        "hard-orange": "4px 4px 0px rgba(252,128,25,0.15)",
        accent:     "0 4px 12px rgba(252,128,25,0.25)",
        "accent-lg":"0 8px 20px rgba(252,128,25,0.30)",
      },
      animation: {
        "fade-in":    "fadeIn 0.4s ease-out forwards",
        "slide-up":   "slideUp 0.3s ease-out forwards",
        "slide-in":   "slideIn 0.5s ease-out forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "bike":       "bikeMove 1s ease-in-out infinite",
        "bounce-in":  "bounceIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        slideIn: {
          "0%":   { transform: "translateX(-12px)", opacity: "0" },
          "100%": { transform: "translateX(0)",     opacity: "1" },
        },
        bikeMove: {
          "0%, 100%": { transform: "translateX(0)" },
          "50%":      { transform: "translateX(4px)" },
        },
        bounceIn: {
          "0%":   { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)",    opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};