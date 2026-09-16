// Kalna Liquor SEO Constants — Central source of truth for AEO, GEO, LLMO & E-E-A-T
export const SITE = {
  name: "Kalna Liquor",
  tagline: "Premium Spirits, Delivered Fast",
  url: "https://liquor-chi.vercel.app",
  backendUrl: "https://swadkart-5wtf.onrender.com",
  logo: "https://liquor-chi.vercel.app/logo.png",
  favicon: "https://liquor-chi.vercel.app/pwa-192x192.png",
  ogImage: "https://liquor-chi.vercel.app/hero.webp",
  locale: "en_IN",
  alternateLocales: ["hi_IN"],
  country: "IN",
  currency: "INR",
  foundingDate: "2025-01-01",
  phone: "+91-80058-11122",
  email: "support@kalnaliquor.com",
  inboxEmail: "support@kalnaliquor.com",
  address: {
    street: "Kalna, Purba Bardhaman",
    city: "Kalna",
    region: "West Bengal",
    postalCode: "713409",
    country: "IN",
  },
  geo: {
    latitude: "23.2313",
    longitude: "88.3720",
  },
  openingHours: [
    { dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "10:00", closes: "22:00" },
  ],
  sameAs: [
    "https://github.com/Swastickc/liquor",
  ],
};

export const DEFAULT_META = {
  title: `${SITE.name} — ${SITE.tagline} | Order Liquor Online in Kalna`,
  description:
    "Order premium liquor online from licensed shops in Kalna, West Bengal. Fast delivery, real-time tracking, AI chatbot, and secure payments.",
  keywords: [
    "liquor delivery app",
    "order liquor online Kalna",
    "online liquor ordering",
    "premium spirits delivery",
    "Kalna Liquor",
    "wine delivery",
    "beer delivery",
  ].join(", "),
};

export const PAGE_PATHS = {
  home: "/",
  restaurants: "/restaurants",
  login: "/login",
  register: "/register",
  cart: "/cart",
  contact: "/contact",
  faq: "/faq",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
};
