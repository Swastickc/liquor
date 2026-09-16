import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Search, MapPin, Clock, Star, ArrowRight, Loader2,
  Trophy, Sparkles, Wine, ShoppingBag, Shield, ChevronRight,
  BadgeCheck, Flame, Beer, Martini
} from "lucide-react";
import { BASEURL } from "../config";
import { getSocket } from "../utils/socket.js";
import PageSEO from "../components/SEO/PageSEO";
import { toJsonLd, localBusinessSchema, breadcrumbSchema } from "../utils/structuredData";
import OrderAgain from "../components/OrderAgain";
import { toast } from "react-hot-toast";

const VoiceSearch = lazy(() => import("../components/VoiceSearch"));
const HERO_IMG_URL = "/hero.webp";

/* ─── Reusable small badge ─── */
function SectionLabel({ children }) {
  return (
    <span className="label-pill">
      <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
      {children}
    </span>
  );
}

/* ─── Animated counter ─── */
function StatCard({ icon: Icon, label, value }) {
  return (
    <div
      className="flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Icon size={20} style={{ color: "var(--accent)" }} />
      <span className="text-2xl font-display" style={{ color: "var(--foreground)" }}>{value}</span>
      <span className="text-xs font-mono uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}

/* ─── Category chip ─── */
function CategoryChip({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
        active
          ? "border-accent bg-accent/10 text-accent shadow-accent"
          : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

/* ─── Shop / Restaurant card ─── */
function ShopCard({ shop, t }) {
  return (
    <Link
      to={`/restaurant/${shop._id}`}
      className="group block rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1"
      style={{ background: "var(--surface)" }}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden" style={{ background: "var(--surface-raised)" }}>
        <img
          src={
            shop.image
              ? `${BASEURL}/api/v1/image/thumbnail?url=${encodeURIComponent(shop.image)}&w=400&q=75&fit=cover`
              : "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&auto=format&fit=crop"
          }
          alt={shop.name || "Shop"}
          loading="lazy"
          onError={(e) => {
            e.target.src =
              "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop";
          }}
          width={400}
          height={267}
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status badge */}
        <div
          className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white shadow-sm ${
            shop.isOpenNow ? "bg-emerald-500/90" : "bg-red-500/80"
          }`}
        >
          {shop.isOpenNow ? t("open") : t("closed")}
        </div>

        {/* Rating */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm"
          style={{ background: "rgba(13,15,20,0.75)", border: "1px solid var(--border)" }}
        >
          <Star size={11} fill="#c8933a" stroke="#c8933a" />
          <span className="text-[11px] font-mono font-bold" style={{ color: "var(--foreground)" }}>
            {shop.rating > 0 ? shop.rating.toFixed(1) : "New"}
          </span>
        </div>

        {/* Performance badge */}
        {shop.performanceScore > 0 && (
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm"
            style={{ background: "rgba(13,15,20,0.75)", border: "1px solid var(--border)" }}
          >
            <Trophy size={10} style={{ color: "var(--accent)" }} />
            <span className="text-[11px] font-mono font-bold" style={{ color: "var(--foreground)" }}>
              {shop.performanceScore}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5">
        <h3
          className="font-display text-xl mb-1 group-hover:text-accent transition-colors"
          style={{ color: "var(--foreground)" }}
        >
          {shop.name || "Shop"}
        </h3>
        <div className="flex items-center gap-1.5 text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>
          <MapPin size={13} style={{ color: "var(--accent)" }} className="shrink-0" />
          <span>Kalna, West Bengal</span>
        </div>
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            <Clock size={12} />
            <span className="text-xs font-mono">30–45 min</span>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider group-hover:gap-2 transition-all"
            style={{ color: "var(--accent)" }}
          >
            Order <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ═══════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════ */
const Home = () => {
  const { t } = useTranslation("common");
  const { userInfo } = useSelector((state) => state.user);
  const [restaurants, setRestaurants] = useState([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
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
        .then((data) => {
          if (data && data.recommendations) setRecommendations(data.recommendations);
        })
        .catch(() => {});
    }
    let socket = null;
    let handleRestaurantUpdate;
    if (userInfo) {
      socket = getSocket();
      socketRef.current = socket;
      handleRestaurantUpdate = (updatedShop) => {
        setRestaurants((prev) => {
          let updated = prev.map((s) =>
            s._id === updatedShop._id ? updatedShop : s
          );
          if (!prev.find((s) => s._id === updatedShop._id))
            updated.push(updatedShop);
          return [...updated].sort(
            (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)
          );
        });
      };
      socket.on("restaurantUpdated", handleRestaurantUpdate);
    }
    return () => {
      abortRecs.abort();
      if (socket && handleRestaurantUpdate)
        socket.off("restaurantUpdated", handleRestaurantUpdate);
    };
  }, [userInfo]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRestaurants(restaurants);
    } else {
      setFilteredRestaurants(
        restaurants.filter(
          (s) => s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, restaurants]);

  const categories = [
    { id: "all",     icon: ShoppingBag, label: "All Shops" },
    { id: "wine",    icon: Wine,        label: "Wine" },
    { id: "beer",    icon: Beer,        label: "Beer" },
    { id: "spirits", icon: Martini,     label: "Spirits" },
    { id: "top",     icon: Flame,       label: "Top Rated" },
  ];

  const statItems = [
    { icon: BadgeCheck,   label: "Licensed Shops", value: restaurants.length || "—" },
    { icon: Clock,        label: "Avg. Delivery",  value: "30 min" },
    { icon: Shield,       label: "Delivery Hours", value: "10AM–10PM" },
    { icon: Shield,       label: "Min. Age",       value: "21+" },
  ];

  return (
    <>
      <PageSEO
        title="Kalna Liquor — Premium Liquor Delivery in Kalna"
        description="Order premium wine, beer, and spirits from licensed shops in Kalna, West Bengal. Fast delivery, real-time tracking, and secure payments."
        url="/"
        image={HERO_IMG_URL}
        schemas={[
          toJsonLd(localBusinessSchema),
          toJsonLd(breadcrumbSchema([{ name: "Home", url: "/" }])),
        ]}
      />

      {/* ═══════ HERO SECTION ═══════ */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Background image with overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={HERO_IMG_URL}
            alt="Premium Liquor Collection"
            className="w-full h-full object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0f14] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
          <div className="max-w-2xl">
            <SectionLabel>Premium Liquor Delivery</SectionLabel>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-display leading-tight animate-fade-in" style={{ color: "var(--foreground)" }}>
              Fine Spirits,{" "}
              <span className="gradient-text">Delivered</span>{" "}
              to Your Door
            </h1>

            <p className="mt-5 text-lg leading-relaxed max-w-lg" style={{ color: "var(--muted-foreground)" }}>
              Browse licensed shops across Kalna. From aged whiskey to craft beer —
              enjoy premium selections with 30-minute delivery.
            </p>

            {/* Search bar */}
            <div className="mt-8 relative max-w-md">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
              />
              <input
                type="text"
                placeholder="Search shops, spirits, wine..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-11 pr-4 py-3.5 text-base"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              />
              <Suspense fallback={null}>
                <VoiceSearch onResult={(text) => setSearchTerm(text)} />
              </Suspense>
            </div>

            {/* Quick stats */}
            <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg">
              {statItems.map((item) => (
                <StatCard key={item.label} {...item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ CATEGORY CHIPS ═══════ */}
      <section className="py-6 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {categories.map((cat) => (
              <CategoryChip
                key={cat.id}
                icon={cat.icon}
                label={cat.label}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Personalised recommendations */}
        {userInfo && recommendations.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center justify-between mb-6">
              <div>
                <SectionLabel>
                  <Sparkles size={12} className="inline -mt-0.5" /> Recommended for You
                </SectionLabel>
                <h2 className="text-2xl font-display mt-3" style={{ color: "var(--foreground)" }}>
                  Because You Ordered Before
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recommendations.map((rec) => (
                <Link
                  key={rec._id || rec.productId}
                  to={`/restaurant/${rec.restaurantId || ""}`}
                  className="group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0" style={{ background: "var(--surface-raised)" }}>
                    {rec.image && (
                      <img
                        src={rec.image}
                        alt={rec.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate" style={{ color: "var(--foreground)" }}>
                      {rec.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>{rec.reason}</p>
                    {rec.price > 0 && (
                      <p className="text-xs mt-1 font-mono" style={{ color: "var(--muted-foreground)" }}>
                        ₹{rec.price}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Order again */}
        {userInfo && (
          <section className="mb-14">
            <OrderAgain />
          </section>
        )}

        {/* ─── Shop listing ─── */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <SectionLabel>Licensed Shops Near You</SectionLabel>
              <h2 className="text-2xl font-display mt-3" style={{ color: "var(--foreground)" }}>
                {searchTerm
                  ? `Results for "${searchTerm}"`
                  : "Explore Shops"}
              </h2>
            </div>
            {filteredRestaurants.length > 0 && (
              <span className="text-sm font-mono" style={{ color: "var(--muted-foreground)" }}>
                {filteredRestaurants.length} shop{filteredRestaurants.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <Loader2 className="animate-spin" size={40} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-mono" style={{ color: "var(--muted-foreground)" }}>
                Loading shops...
              </span>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4 text-center">
              <ShoppingBag size={48} style={{ color: "var(--muted-foreground)" }} />
              <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                No shops found
              </p>
              <p className="text-sm max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                {searchTerm
                  ? "Try a different search term or clear your search."
                  : "No licensed shops available right now. Please check back later."}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="btn-accent px-5 py-2.5 text-sm mt-2"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((shop) => (
                <ShopCard key={shop._id} shop={shop} t={t} />
              ))}
            </div>
          )}
        </section>

        {/* ─── Trust banner ─── */}
        <section className="mt-20 mb-8">
          <div
            className="rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-8 border"
            style={{
              background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-raised) 100%)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-xl font-display" style={{ color: "var(--foreground)" }}>
                100% Licensed & Verified
              </h3>
              <p className="mt-2 text-sm leading-relaxed max-w-md" style={{ color: "var(--muted-foreground)" }}>
                Every shop on Kalna Liquor is government-licensed and verified.
                We ensure responsible service and age-verified delivery.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-1">
                <Shield size={28} style={{ color: "var(--accent)" }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Secure
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <BadgeCheck size={28} style={{ color: "var(--accent)" }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Verified
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Clock size={28} style={{ color: "var(--accent)" }} />
                <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Fast
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
};

export default Home;
