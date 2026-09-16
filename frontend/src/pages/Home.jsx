import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Search, MapPin, Clock, Star, ArrowRight, Loader2,
  Trophy, Sparkles, Wine, ShoppingBag, Shield, ChevronRight
} from "lucide-react";
import { BASEURL } from "../config";
import { getSocket } from "../utils/socket.js";
import PageSEO from "../components/SEO/PageSEO";
import { toJsonLd, localBusinessSchema, breadcrumbSchema } from "../utils/structuredData";
import OrderAgain from "../components/OrderAgain";
import { toast } from "react-hot-toast";

const VoiceSearch = lazy(() => import("../components/VoiceSearch"));
const HERO_IMG_URL = "/hero.webp";

function SectionLabel({ children }) {
  return (
    <span className="label-pill">
      <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
      {children}
    </span>
  );
}

function ShopCard({ shop, t }) {
  return (
    <Link
      to={`/restaurant/${shop._id}`}
      className="group block rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
      style={{ background: "var(--surface)" }}
    >
      <div className="relative h-48 overflow-hidden" style={{ background: "var(--surface-raised)" }}>
        <img
          src={shop.image ? `${BASEURL}/api/v1/image/thumbnail?url=${encodeURIComponent(shop.image)}&w=400&q=75&fit=cover` : "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&auto=format&fit=crop"}
          alt={shop.name || "Shop"}
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"; }}
          width={400} height={267}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white shadow-sm ${shop.isOpenNow ? "bg-emerald-500/90" : "bg-red-500/80"}`}>
          {shop.isOpenNow ? t("open") : t("closed")}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm" style={{ background: "rgba(13,15,20,0.75)", border: "1px solid var(--border)" }}>
          <Star size={11} fill="#c8933a" stroke="#c8933a" />
          <span className="text-[11px] font-mono font-bold" style={{ color: "var(--foreground)" }}>{shop.rating > 0 ? shop.rating.toFixed(1) : "New"}</span>
        </div>
        {shop.performanceScore > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm" style={{ background: "rgba(13,15,20,0.75)", border: "1px solid var(--border)" }}>
            <Trophy size={10} style={{ color: "var(--accent)" }} />
            <span className="text-[11px] font-mono font-bold" style={{ color: "var(--foreground)" }}>{shop.performanceScore}</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl mb-1 group-hover:text-accent transition-colors" style={{ color: "var(--foreground)" }}>
          {shop.name || "Shop"}
        </h3>
        <div className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
          <MapPin size={13} style={{ color: "var(--accent)" }} className="shrink-0" />
          <span>Kalna, West Bengal</span>
        </div>
        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            <Clock size={12} />
            <span className="text-xs font-mono">30–45 min</span>
          </div>
          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider group-hover:gap-2 transition-all" style={{ color: "var(--accent)" }}>
            Order <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}

const Home = () => {
  const { t } = useTranslation("common");
  const { userInfo } = useSelector((state) => state.user);
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  useEffect(() => {
    fetchRestaurants();
    const abortRecs = new AbortController();
    if (userInfo) {
      fetch(`${BASEURL}/api/v1/analytics/recommendations?limit=6`, {
        credentials: "include",
        signal: abortRecs.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data && data.recommendations) setRecommendations(data.recommendations); })
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

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRestaurants(restaurants);
    } else {
      setFilteredRestaurants(
        restaurants.filter((s) => s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
  }, [searchTerm, restaurants]);

  const statItems = [
    { label: "Licensed Shops",  value: restaurants.length || "—" },
    { label: "Avg. Delivery",   value: "30 min" },
    { label: "Delivery Hours",  value: "10AM–10PM" },
    { label: "Min. Age",        value: "21 Years" },
  ];

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRestaurants(restaurants);
    } else {
      setFilteredRestaurants(
        restaurants.filter((s) => s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
  }, [searchTerm, restaurants]);

  return (
    <>
      <PageSEO
        title="Order Liquor Online - Kalna Liquor Delivery"
        description="Order premium liquor online in Kalna. Fast delivery, real-time tracking, secure Razorpay payments. Open 10 AM to 10 PM."
        canonicalPath="/"
        jsonLdScripts={[toJsonLd(localBusinessSchema()), toJsonLd(breadcrumbSchema([{ name: "Home", url: "/" }]))]}
      />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: "var(--background)" }}>
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG_URL} alt="" aria-hidden="true" className="w-full h-full object-cover" style={{ opacity: 0.15 }} loading="eager" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, var(--background) 45%, rgba(13,15,20,0.6) 100%)" }} />
        </div>
        <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(200,147,58,0.07) 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-32 pb-20 w-full">
          <div className="max-w-3xl">
            <div className="age-badge mb-6">
              <Shield size={11} />
              21+ Only — Valid ID Required on Delivery
            </div>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-none tracking-tight mb-6" style={{ color: "var(--foreground)" }}>
              Premium Spirits,<br />
              <span className="gradient-text">Delivered Fast.</span>
            </h1>
            <p className="text-lg mb-10 max-w-xl" style={{ color: "var(--muted-foreground)" }}>
              Order from licensed liquor shops across Kalna, West Bengal. Discreet, legal, 10 AM–10 PM daily.
            </p>
            <div className="relative max-w-xl mb-6">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted-foreground)" }} />
              <input
                type="search"
                placeholder="Search shops…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-11 pr-12 py-4 text-base"
                aria-label="Search shops"
              />
              <Suspense fallback={null}>
                <VoiceSearch setSearchTerm={setSearchTerm} />
              </Suspense>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="#shops" className="btn-accent px-7 py-3.5 text-sm flex items-center gap-2 group">
                Browse Shops
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
              {!userInfo && (
                <Link to="/register" className="btn-ghost px-7 py-3.5 text-sm">
                  Create Account
                </Link>
              )}
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statItems.map(({ label, value }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>{label}</p>
                <p className="font-display text-2xl" style={{ color: "var(--foreground)" }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ──────────────────────────────────────────── */}
      <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-5 flex flex-wrap justify-center gap-8">
          {[
            { icon: <Shield size={15} />, text: "Age-verified 21+" },
            { icon: <Clock size={15} />, text: "10 AM – 10 PM delivery" },
            { icon: <Wine size={15} />, text: "Licensed shops only" },
            { icon: <ShoppingBag size={15} />, text: "Razorpay secured" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
              <span style={{ color: "var(--accent)" }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── SHOPS ────────────────────────────────────────────────── */}
      <section id="shops" className="py-24 lg:py-32" style={{ background: "var(--background)" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="mb-14">
            <SectionLabel>Licensed Shops</SectionLabel>
            <h2 className="font-display text-4xl lg:text-5xl mt-4" style={{ color: "var(--foreground)" }}>
              {searchTerm ? `Results for "${searchTerm.slice(0, 40)}"` : t("topRestaurants")}
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-32">
              <Loader2 size={40} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-24 rounded-2xl" style={{ border: "1px dashed var(--border)" }}>
              <ShoppingBag size={40} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
              <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>{t("noResults")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((shop) => (
                <ShopCard key={shop._id} shop={shop} t={t} />
              ))}
            </div>
          )}
          <OrderAgain />
          {recommendations.length > 0 && (
            <div className="mt-24">
              <div className="mb-10">
                <SectionLabel>AI Picks</SectionLabel>
                <h2 className="font-display text-3xl lg:text-4xl mt-4 flex items-center gap-3" style={{ color: "var(--foreground)" }}>
                  Recommended <span className="gradient-text">For You</span>
                  <Sparkles size={22} style={{ color: "var(--accent)" }} />
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {recommendations.map((rec, idx) => (
                  <Link
                    key={rec._id ? rec._id.toString() : rec.productId ? rec.productId.toString() : idx}
                    to={`/restaurant/${rec.restaurant}`}
                    className="group rounded-xl overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="h-28 overflow-hidden" style={{ background: "var(--surface-raised)" }}>
                      <img
                        src={rec.image || "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300"}
                        alt={rec.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>{rec.name}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: "var(--accent)" }}>{rec.reason}</p>
                      {rec.price > 0 && (
                        <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted-foreground)" }}>₹{rec.price}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default Home;
