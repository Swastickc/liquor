import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Search, MapPin, Clock, Star, ArrowRight, Loader2,
  Trophy, Sparkles, Shield, ChevronRight,
  ShoppingBag, Wine, Beer, Martini,
  BadgeCheck, Store, Truck, Timer,
} from "lucide-react";
import { BASEURL } from "../config";
import { getSocket } from "../utils/socket.js";
import PageSEO from "../components/SEO/PageSEO";
import { toJsonLd, localBusinessSchema, breadcrumbSchema } from "../utils/structuredData";
import OrderAgain from "../components/OrderAgain";
import { toast } from "react-hot-toast";

const VoiceSearch = lazy(() => import("../components/VoiceSearch"));
const HERO_IMG_URL = "/hero.webp";

/* ─── Category pills ─── */
const CATEGORIES = [
  { name: "Whisky", emoji: "🥃", color: "#c8933a" },
  { name: "Vodka", emoji: "🍸", color: "#4a90d9" },
  { name: "Rum", emoji: "🍹", color: "#8b4513" },
  { name: "Beer", emoji: "🍺", color: "#f0ad4e" },
  { name: "Wine", emoji: "🍷", color: "#9b2c2c" },
  { name: "Brandy", emoji: "🥂", color: "#d4a574" },
  { name: "Gin", emoji: "🍸", color: "#5bc0de" },
  { name: "Sake", emoji: "🍶", color: "#e8d5b7" },
];

/* ─── Shop Card ─── */
function ShopCard({ shop, t }) {
  const deliveryFee = shop.deliveryFee || 0;
  return (
    <Link
      to={`/restaurant/${shop._id}`}
      className="group block rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-hover hover:-translate-y-0.5 bg-surface"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-surface-raised">
        <img
          src={shop.image
            ? `${BASEURL}/api/v1/image/thumbnail?url=${encodeURIComponent(shop.image)}&w=400&q=75&fit=cover`
            : "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"
          }
          alt={shop.name || "Shop"}
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"; }}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Status badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white shadow-sm ${
          shop.isOpenNow ? "bg-emerald-500/90" : "bg-red-500/80"
        }`}>
          {shop.isOpenNow ? t("open") : t("closed")}
        </div>

        {/* Rating badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-white/10">
          <Star size={11} fill="#f0ad4e" stroke="#f0ad4e" />
          <span className="text-[11px] font-mono font-bold text-white">
            {shop.rating > 0 ? shop.rating.toFixed(1) : "New"}
          </span>
        </div>

        {/* Performance score */}
        {shop.performanceScore > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
            <Trophy size={10} className="text-accent" />
            <span className="text-[11px] font-mono font-bold text-white">{shop.performanceScore}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <h3 className="font-display text-lg leading-tight text-foreground group-hover:text-accent transition-colors">
          {shop.name || "Shop"}
        </h3>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin size={13} className="text-accent shrink-0" />
          <span>Kalna, West Bengal</span>
        </div>

        {/* Delivery info row */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={12} />
            <span className="font-mono">30–45 min</span>
          </div>
          {deliveryFee > 0 ? (
            <span className="text-xs font-mono text-muted-foreground">₹{deliveryFee} delivery</span>
          ) : (
            <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
              <BadgeCheck size={12} /> Free
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="pt-1">
          <span className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-accent/10 text-accent border border-accent/20 group-hover:bg-accent group-hover:text-white transition-all">
            View Shop <ChevronRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ─── Trust Badge ─── */
function TrustBadge({ icon: Icon, text, sub }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border/60">
      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-accent" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{text}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 text-center">
      <p className="text-2xl font-display text-foreground">{value}</p>
      <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/* ─── Main Home Component ─── */
const Home = () => {
  const { t } = useTranslation("common");
  const { userInfo } = useSelector((state) => state.user);
  const [searchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const socketRef = useRef(null);

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${BASEURL}/api/v1/restaurants`);
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const data = await res.json();
      const allShops = Array.isArray(data) ? data : data.restaurants || [];
      const sortedShops = allShops.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      setRestaurants(sortedShops);
      setFilteredRestaurants(sortedShops);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      toast.error("Failed to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load + socket
  useEffect(() => {
    fetchRestaurants();
    const abortRecs = new AbortController();
    if (userInfo) {
      fetch(`${BASEURL}/api/v1/analytics/recommendations?limit=6`, {
        credentials: "include", signal: abortRecs.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data?.recommendations) setRecommendations(data.recommendations); })
        .catch(() => {});
    }
    let socket = null;
    let handleRestaurantUpdate;
    if (userInfo) {
      socket = getSocket();
      socketRef.current = socket;
      handleRestaurantUpdate = (updatedShop) => {
        setRestaurants((prev) => {
          let updated = prev.map((s) => (s._id === updatedShop._id ? updatedShop : s));
          if (!prev.find((s) => s._id === updatedShop._id)) updated.push(updatedShop);
          return [...updated].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        });
      };
      socket.on("restaurantUpdated", handleRestaurantUpdate);
    }
    return () => {
      abortRecs.abort();
      if (socket && handleRestaurantUpdate) socket.off("restaurantUpdated", handleRestaurantUpdate);
    };
  }, [userInfo]);

  // Search filter
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRestaurants(restaurants);
    } else {
      const q = searchTerm.toLowerCase();
      setFilteredRestaurants(
        restaurants.filter((s) => s.name && s.name.toLowerCase().includes(q))
      );
    }
  }, [searchTerm, restaurants]);

  // Read search param from URL
  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) setSearchTerm(urlSearch);
  }, [searchParams]);

  const statItems = [
    { label: "Licensed Shops", value: restaurants.length || "—" },
    { label: "Avg. Delivery",  value: "30 min" },
    { label: "Delivery Hours", value: "10AM–10PM" },
    { label: "Min. Age",       value: "21 Years" },
  ];

  return (
    <>
      <PageSEO
        title="Kalna Liquor — Order Liquor Online in Kalna | Fast Delivery"
        description="Order premium liquor online from licensed shops in Kalna, West Bengal. Fast delivery, real-time tracking, secure payments. 10 AM to 10 PM daily."
        canonicalPath="/"
        jsonLdScripts={[
          toJsonLd(localBusinessSchema()),
          toJsonLd(breadcrumbSchema([{ name: "Home", url: "/" }])),
        ]}
      />

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative pt-28 pb-12 md:pt-36 md:pb-16 overflow-hidden bg-background">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG_URL} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-10" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-background/80" />
        </div>
        <div className="absolute top-40 right-1/4 w-96 h-96 rounded-full pointer-events-none bg-accent/5 blur-[100px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl">
            {/* Age badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-6">
              <Shield size={12} />
              21+ Only — Valid ID Required
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight text-foreground mb-4">
              Premium Spirits,<br />
              <span className="text-accent">Delivered Fast.</span>
            </h1>

            <p className="text-base md:text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              Order from licensed liquor shops across Kalna, West Bengal. 
              Discreet packaging, legal delivery, 10 AM – 10 PM.
            </p>

            {/* Search */}
            <div className="relative max-w-xl mb-8">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder="Search for Whisky, Rum, Beer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface border border-border rounded-2xl pl-11 pr-12 py-4 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                aria-label="Search shops"
              />
              <Suspense fallback={null}>
                <VoiceSearch setSearchTerm={setSearchTerm} />
              </Suspense>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3">
              <a href="#shops" className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-light text-white font-bold rounded-xl transition-all shadow-accent/20 hover:shadow-accent/30">
                Browse Shops <ArrowRight size={16} />
              </a>
              {!userInfo && (
                <Link to="/register" className="inline-flex items-center px-6 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-surface transition-all">
                  Create Account
                </Link>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {statItems.map(({ label, value }) => (
              <StatCard key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ────────────────────────────────── */}
      <section className="py-10 bg-background border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Shop by Category</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to={`/?category=${cat.name.toLowerCase()}`}
                className="flex flex-col items-center gap-2 px-5 py-3 rounded-2xl border border-border bg-surface hover:border-accent/40 hover:bg-surface-raised transition-all shrink-0 min-w-[90px]"
              >
                <span className="text-2xl">{cat.emoji}</span>
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES ──────────────────────────────── */}
      <section className="py-6 bg-surface/50 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <TrustBadge icon={Shield} text="Age Verified 21+" sub="Valid ID required" />
            <TrustBadge icon={Timer} text="10 AM – 10 PM" sub="Daily delivery hours" />
            <TrustBadge icon={Store} text="Licensed Shops" sub="Govt. approved vendors" />
            <TrustBadge icon={Truck} text="30-45 min Delivery" sub="Track in real-time" />
          </div>
        </div>
      </section>

      {/* ── SHOPS GRID ────────────────────────────────── */}
      <section id="shops" className="py-12 md:py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-accent">
                {searchTerm ? `Results for "${searchTerm.slice(0, 40)}"` : "All Shops"}
              </span>
              <h2 className="font-display text-2xl md:text-3xl text-foreground mt-1">
                {searchTerm ? "Search Results" : t("topRestaurants")}
              </h2>
            </div>
            {!searchTerm && restaurants.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {restaurants.length} shop{restaurants.length !== 1 ? "s" : ""} near you
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 size={36} className="animate-spin text-accent" />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-border">
              <ShoppingBag size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">No shops found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {filteredRestaurants.map((shop) => (
                <ShopCard key={shop._id} shop={shop} t={t} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ORDER AGAIN ──────────────────────────────── */}
      {userInfo && <OrderAgain />}

      {/* ── RECOMMENDATIONS ──────────────────────────── */}
      {recommendations.length > 0 && (
        <section className="py-12 bg-surface/30 border-t border-border/40">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-8">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-accent">AI Picks</span>
                <h2 className="font-display text-2xl md:text-3xl text-foreground mt-1 flex items-center gap-2">
                  Recommended For You
                  <Sparkles size={20} className="text-accent" />
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {recommendations.map((rec, idx) => (
                <Link
                  key={rec._id ? rec._id.toString() : idx}
                  to={`/restaurant/${rec.restaurant}`}
                  className="group rounded-xl overflow-hidden border border-border bg-surface hover:border-accent/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="h-28 overflow-hidden bg-surface-raised">
                    <img
                      src={rec.image || "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300"}
                      alt={rec.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold truncate text-foreground">{rec.name}</p>
                    {rec.reason && (
                      <p className="text-[10px] font-medium text-accent mt-0.5">{rec.reason}</p>
                    )}
                    {rec.price > 0 && (
                      <p className="text-xs mt-1 font-mono text-muted-foreground">₹{rec.price}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default Home;