/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy alias kept so admin/delivery pages don't break
        primary: "#c8933a",
        secondary: "#1a1e28",

        // Premium dark theme tokens (mirror CSS custom properties)
        background:        "#0d0f14",
        surface:           "#13161e",
        "surface-raised":  "#1a1e28",
        foreground:        "#edeef2",
        muted:             "#1a1e28",
        "muted-foreground":"#8891a8",
        accent:            "#c8933a",
        "accent-light":    "#dba954",
        "accent-dim":      "#8f6426",
        border:            "#2a2f3d",
        "border-subtle":   "#1e2230",
        card:              "#13161e",
        success:           "#2ecc71",
        danger:            "#e0364a",
        warning:           "#e8a135",
        info:              "#4a90d9",
      },
      fontFamily: {
        display: ["Calistoga", "Georgia", "serif"],
        sans:    ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #c8933a 0%, #dba954 100%)",
        "surface-gradient":"linear-gradient(180deg, #13161e 0%, #0d0f14 100%)",
      },
      boxShadow: {
        card:       "0 2px 12px rgba(0,0,0,0.45)",
        "card-hover":"0 8px 32px rgba(0,0,0,0.55)",
        float:      "0 16px 48px rgba(0,0,0,0.65)",
        accent:     "0 4px 16px rgba(200,147,58,0.30)",
        "accent-lg":"0 8px 24px rgba(200,147,58,0.38)",
        // legacy
        "neon-primary": "0 0 15px rgba(200,147,58,0.4)",
      },
      gridTemplateColumns: {
        hero: "1.1fr 0.9fr",
      },
      animation: {
        "fade-in":        "fadeIn 0.5s ease-out forwards",
        "slide-up":       "slideUp 0.4s ease-out forwards",
        "slide-in-bottom":"slideInBottom 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        slideInBottom: {
          "0%":   { transform: "translateY(32px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
