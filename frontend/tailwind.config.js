/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Legacy primary kept for admin/delivery pages
        primary: "#ff6b6b",
        secondary: "#1a1a1a",

        // Minimalist Modern Design System
        background: "#FAFAFA",
        foreground: "#0F172A",
        muted: "#F1F5F9",
        "muted-foreground": "#64748B",
        accent: "#0052FF",
        "accent-light": "#4D7CFF",
        border: "#E2E8F0",
        card: "#FFFFFF",

        dark: {
          950: "#030712",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
      },
      fontFamily: {
        display: ["Calistoga", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)",
      },
      boxShadow: {
        "neon-primary": "0 0 15px rgba(255, 107, 107, 0.4)",
        accent: "0 8px 32px rgba(0, 82, 255, 0.25)",
        "card-hover": "0 20px 40px rgba(15, 23, 42, 0.12)",
      },
      gridTemplateColumns: {
        hero: "1.1fr 0.9fr",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.4s ease-out forwards",
        "slide-in-bottom": "slideInBottom 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInBottom: {
          "0%": { transform: "translateY(32px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
