/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#fc8019",
        secondary: "#f8f8f8",

        background:        "#ffffff",
        surface:           "#ffffff",
        "surface-raised":  "#f8f8f8",
        foreground:        "#282c3f",
        muted:             "#f8f8f8",
        "muted-foreground":"#686b78",
        accent:            "#fc8019",
        "accent-light":    "#ff9a40",
        "accent-dim":      "#e06800",
        border:            "#e9eaec",
        "border-subtle":   "#f0f0f0",
        card:              "#ffffff",
        success:           "#48c479",
        danger:            "#e0364a",
        warning:           "#f7a742",
        info:              "#5d8ed5",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        sans:    ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #fc8019 0%, #ff9a40 100%)",
      },
      boxShadow: {
        card:       "0 1px 5px rgba(40,44,63,0.08)",
        "card-hover":"0 8px 20px rgba(40,44,63,0.12)",
        float:      "0 12px 30px rgba(40,44,63,0.15)",
        accent:     "0 4px 12px rgba(252,128,25,0.25)",
        "accent-lg":"0 8px 20px rgba(252,128,25,0.30)",
      },
      animation: {
        "fade-in":  "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.3s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};