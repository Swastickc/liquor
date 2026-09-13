import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Search, MapPin, Clock, Star, ArrowRight, Loader2,
  Trophy, Sparkles, Wine, ShoppingBag, Zap, Shield
} from "lucide-react";
import { BASEURL } from "../config";
import { getSocket } from "../utils/socket.js";
import PageSEO from "../components/SEO/PageSEO";
import { toJsonLd, localBusinessSchema, breadcrumbSchema } from "../utils/structuredData";
import OrderAgain from "../components/OrderAgain";
import { toast } from "react-hot-toast";

const VoiceSearch = lazy(() => import("../components/VoiceSearch"));
const HERO_IMG_URL = "/hero.webp";

// Section label pill
function SectionLabel({ children }) {
  return (
    <span className="label-pill">
      <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
      {children}
    </span>
  );
}

// Shop card
function ShopCard({ shop, t }) {
  return (
    <Link
      to={`/restaurant/${shop._id}`}
      className="group block bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
    >
      <div className="relative h-48 overflow-hidden bg-muted">
        <img
          src={shop.image ? `${BASEURL}/api/v1/image/thumbnail?url=${encodeURIComponent(shop.image)}&w=400&q=75&fit=cover` : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=70&fm=webp&auto=format&fit=crop"}
          alt={shop.name || "Shop"}
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=70&fm=webp&fit=crop"; }}
          width={400} height={267}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider text-white shadow-sm ${shop.isOpenNow ? "bg-emerald-500" : "bg-red-500/90"}`}>
          {shop.isOpenNow ? t("open") : t("closed")}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
          <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
          <span className="text-[11px] font-mono font-bold text-foreground">{shop.rating > 0 ? shop.rating.toFixed(1) : "New"}</span>
        </div>
        {shop.performanceScore > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
            <Trophy size={10} className="text-amber-500" />
            <span className="text-[11px] font-mono font-bold text-foreground">{shop.performanceScore}</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl text-foreground mb-1 group-hover:text-accent transition-colors">
          {shop.name || "Shop"}
        </h3>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm mb-4">
          <MapPin size={13} className="text-accent shrink-0" />
          <span>Kalna, West Bengal</span>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <Clock size={13} />
            <span>{shop.isOpenNow ? t("deliveryTime") : t("currentlyClosed")}</span>
          </div>
          <span className="flex items-center gap-1 text-accent text-sm font-semibold group-hover:translate-x-1 transition-transform">
            {t("viewMenu")} <ArrowRight size={14} />
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

  return (
    <>
      <PageSEO
        title="Order Liquor Online - Kalna Liquor Delivery"
        description="Order premium liquor online in Kalna. Fast delivery, real-time tracking, secure Razorpay payments. Open 10 AM to 10 PM."
        canonicalPath="/"
        jsonLdScripts={[toJsonLd(localBusinessSchema()), toJsonLd(breadcrumbSchema([{ name: "Home", url: "/" }]))]}
      />

      {/* HERO */}
      <section className="relative bg-foreground min-h-[88vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMG_URL} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-20" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/70 to-foreground/30" />
        </div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-hero gap-12 items-center">
          <div className="space-y-8">
            <SectionLabel>Kalna&apos;s #1 Liquor Delivery</SectionLabel>
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.05]">
              Premium Spirits,{" "}
              <span className="gradient-text">Delivered Fast</span>
            </h1>
            <p className="text-white/60 text-lg max-w-lg leading-relaxed">
              Order your favourite beers, wines, and spirits from licensed shops. Real-time tracking, secure payments available 10 AM to 10 PM.
            </p>
            <div className="relative max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                placeholder="Search shops..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search shops"
                className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/40 rounded-xl pl-11 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:border-accent focus:bg-white/15 transition-all duration-200 backdrop-blur"
              />
              {searchTerm && (
                <Suspense fallback={null}>
                  <VoiceSearch setSearchTerm={setSearchTerm} />
                </Suspense>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <a href="#shops" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-accent text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-accent active:scale-[0.98]">
                Browse Shops <ArrowRight size={16} />
              </a>
              {!userInfo && (
                <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm border border-white/20 text-white hover:bg-white/10 transition-all duration-200 hover:-translate-y-0.5">
                  Create Account
                </Link>
              )}
            </div>
            <div className="flex items-center gap-6 pt-2">
              {[
                { icon: Shield, label: "Age-verified 21+" },
                { icon: Zap, label: "30-min delivery" },
                { icon: Wine, label: "100% licensed" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-white/50 text-xs font-mono uppercase tracking-wider">
                  <Icon size={14} className="text-accent" />
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden lg:flex justify-end">
            <div className="bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-8 space-y-5 w-64">
              {[
                { label: "Shops Available", value: restaurants.length || "--" },
                { label: "Delivery Hours", value: "10AM-10PM" },
                { label: "Min. Age", value: "21 Years" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-white text-2xl font-display">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SHOPS */}
      <section id="shops" className="bg-background py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="mb-14">
            <SectionLabel>Licensed Shops</SectionLabel>
            <h2 className="font-display text-4xl lg:text-5xl text-foreground mt-4">
              {searchTerm ? `Results for "${searchTerm.slice(0, 40)}"` : t("topRestaurants")}
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-32">
              <Loader2 size={40} className="animate-spin text-accent" />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-24 border border-dashed border-border rounded-2xl">
              <ShoppingBag size={40} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">{t("noResults")}</p>
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
                <h2 className="font-display text-3xl lg:text-4xl text-foreground mt-4 flex items-center gap-3">
                  Recommended <span className="gradient-text">For You</span>
                  <Sparkles size={24} className="text-accent" />
                </h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {recommendations.map((rec, idx) => (
                  <Link
                    key={rec._id ? rec._id.toString() : rec.productId ? rec.productId.toString() : idx}
                    to={`/restaurant/${rec.restaurant}`}
                    className="group bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
                  >
                    <div className="h-28 overflow-hidden bg-muted">
                      <img
                        src={rec.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300"}
                        alt={rec.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-foreground truncate">{rec.name}</p>
                      <p className="text-xs text-accent font-medium mt-0.5">{rec.reason}</p>
                      {rec.price > 0 && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">Rs. {rec.price}</p>
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
