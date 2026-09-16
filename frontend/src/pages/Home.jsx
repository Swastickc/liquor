import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Search, MapPin, Clock, Star, ArrowRight, Loader2,
  Sparkles, Shield, ChevronRight, ChevronDown, Bike,
  ShoppingBag, Timer, Store, Truck, Award, BadgeCheck,
  Percent, Zap, Beer, Wine, Flame,
} from "lucide-react";
import { BASEURL } from "../config";
import { getSocket } from "../utils/socket.js";
import PageSEO from "../components/SEO/PageSEO";
import { toJsonLd, localBusinessSchema, breadcrumbSchema } from "../utils/structuredData";
import OrderAgain from "../components/OrderAgain";
import { toast } from "react-hot-toast";

const VoiceSearch = lazy(() => import("../components/VoiceSearch"));

/* ─── Categories with images ────────────────────────── */
const CATEGORIES = [
  { name: "Whisky", emoji: "🥃", desc: "Single malt & blend", img: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300&q=70&fm=webp&fit=crop" },
  { name: "Vodka",  emoji: "🍸", desc: "Premium spirits",   img: "https://images.unsplash.com/photo-1578911595546-1a0e7e7e0a0b?w=300&q=70&fm=webp&fit=crop" },
  { name: "Rum",    emoji: "🍹", desc: "Dark & white",      img: "https://images.unsplash.com/photo-1514362545857-3bc16c4c0f7a?w=300&q=70&fm=webp&fit=crop" },
  { name: "Beer",   emoji: "🍺", desc: "Craft & imported",   img: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300&q=70&fm=webp&fit=crop" },
  { name: "Wine",   emoji: "🍷", desc: "Red, white & rose",  img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=300&q=70&fm=webp&fit=crop" },
  { name: "Brandy", emoji: "🥂", desc: "Cognac & more",      img: "https://images.unsplash.com/photo-1578911595546-1a0e7e7e0a0b?w=300&q=70&fm=webp&fit=crop" },
  { name: "Gin",    emoji: "🍸", desc: "London dry & more",  img: "https://images.unsplash.com/photo-1578911595546-1a0e7e7e0a0b?w=300&q=70&fm=webp&fit=crop" },
  { name: "Champagne", emoji: "🍾", desc: "Celebration special", img: "https://images.unsplash.com/photo-1578911595546-1a0e7e7e0a0b?w=300&q=70&fm=webp&fit=crop" },
];

/* ─── Category Tile — Swiggy style ────────────────── */
function CategoryTile({ cat }) {
  return (
    <Link
      to={`/?category=${cat.name.toLowerCase()}`}
      className="category-tile group"
    >
      <img src={cat.img} alt={cat.name} loading="lazy" />
      <div className="overlay">
        <span className="text-base font-bold leading-tight">{cat.emoji} {cat.name}</span>
        <span className="text-[10px] text-white/80 mt-0.5">{cat.desc}</span>
      </div>
    </Link>
  );
}

/* ─── Shop Card — Swiggy style with delivery badge ── */
function ShopCard({ shop }) {
  const isHighRated = shop.rating >= 4.0;
  const isMidRated  = shop.rating >= 3.0 && shop.rating < 4.0;

  return (
    <Link
      to={`/restaurant/${shop._id}`}
      className="card-swiggy-hard w-[280px] shrink-0 group animate-fade-in"
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl bg-gray-100">
        <img
          src={shop.image
            ? `${BASEURL}/api/v1/image/thumbnail?url=${encodeURIComponent(shop.image)}&w=400&q=75&fit=cover`
            : "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"}
          alt={shop.name || "Shop"}
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"; }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Open/Closed badge */}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-white shadow-sm ${
          shop.isOpenNow ? "bg-green-500" : "bg-gray-400"
        }`}>
          {shop.isOpenNow ? "Open" : "Closed"}
        </span>

        {/* Rating badge */}
        <span className={`absolute bottom-3 left-3 rating-badge ${
          isHighRated ? "rating-high" : isMidRated ? "rating-mid" : "rating-low"
        }`}>
          <Star size={10} fill="currentColor" stroke="none" />
          <span>{shop.rating > 0 ? shop.rating.toFixed(1) : "NEW"}</span>
        </span>
      </div>

      {/* Details */}
      <div className="p-4">
        <h3 className="font-bold text-[15px] text-gray-800 line-clamp-1 group-hover:text-orange-500 transition-colors">
          {shop.name || "Shop"}
        </h3>

        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
          <MapPin size={12} className="text-gray-400 shrink-0" />
          <span className="line-clamp-1">Kalna, West Bengal</span>
          <span className="text-gray-300 mx-1">·</span>
          <Clock size={12} className="text-gray-400 shrink-0" />
          <span className="font-semibold">30–45 min</span>
        </div>

        {/* Delivery info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="delivery-badge">
            <Truck size={11} />
            <span>Free</span>
          </span>
          <span className="text-[11px] font-semibold text-gray-500">
            0.5 km away
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={(e) => { e.preventDefault(); window.location.href = `/restaurant/${shop._id}`; }}
          className="mt-3 w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-50 border border-orange-100 hover:bg-orange-500 hover:text-white transition-all active:scale-[0.98]"
        >
          Quick View
        </button>
      </div>
    </Link>
  );
}

/* ─── Main ──────────────────────────────────────────── */
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

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRestaurants(restaurants);
    } else {
      const q = searchTerm.toLowerCase();
      setFilteredRestaurants(restaurants.filter((s) => s.name?.toLowerCase().includes(q)));
    }
  }, [searchTerm, restaurants]);

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) setSearchTerm(urlSearch);
  }, [searchParams]);

  const openShops = restaurants.filter((s) => s.isOpenNow);
  const topRated = [...restaurants].sort((a, b) => (b.rating || 0) - (a.rating || 0));

  return (
    <>
      <PageSEO
        title="Kalna Liquor — Order Liquor Online in Kalna | Fast Delivery"
        description="Order premium liquor online from licensed shops in Kalna, West Bengal. Fast delivery, real-time tracking, secure payments."
        canonicalPath="/"
        jsonLdScripts={[
          toJsonLd(localBusinessSchema()),
          toJsonLd(breadcrumbSchema([{ name: "Home", url: "/" }])),
        ]}
      />

      {/* ══════════════════════════════════════════════
          HERO — Swiggy-style orange-yellow gradient
          ══════════════════════════════════════════════ */}
      <section className="banner-orange pt-14 pb-8 md:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Location */}
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white/90 mb-4">
            <MapPin size={16} className="text-white" />
            <span>Kalna, West Bengal</span>
            <ChevronDown size={14} className="opacity-70" />
          </div>

          {/* Hero content */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[11px] font-bold text-white uppercase tracking-wider mb-3">
                <Shield size={12} />
                21+ Only
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
                Premium spirits, <br className="hidden sm:block" />
                <span className="text-yellow-200">delivered to your door.</span>
              </h1>
            </div>
            <div className="flex gap-2 shrink-0">
              <a href="#shops" className="bg-white text-orange-500 font-bold px-5 py-2.5 rounded-lg text-sm hover:bg-orange-50 transition-all shadow-lg animate-bounce-in">
                Browse Shops <ArrowRight size={16} className="inline" />
              </a>
              {!userInfo && (
                <Link to="/register" className="bg-white/20 backdrop-blur-sm text-white font-semibold px-5 py-2.5 rounded-lg text-sm border border-white/30 hover:bg-white/30 transition-all">
                  Sign Up
                </Link>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder='Search "Whisky", "Beer", "Wine"...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border-0 rounded-xl pl-11 pr-12 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 shadow-lg"
              aria-label="Search"
            />
            <Suspense fallback={null}>
              <VoiceSearch setSearchTerm={setSearchTerm} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TRUST STRIP — White info bar
          ══════════════════════════════════════════════ */}
      <section className="bg-white border-b border-gray-100 -mt-3 relative z-10 rounded-t-2xl mx-4 sm:mx-6 lg:mx-8 max-w-7xl lg:mx-auto shadow-sm">
        <div className="flex items-center justify-around py-3 px-4">
          {[
            { icon: Timer, text: "10AM–10PM" },
            { icon: Bike, text: "30–45 min" },
            { icon: Shield, text: "21+ Verified" },
            { icon: Truck, text: "Free delivery" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <Icon size={14} className="text-orange-500" />
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          POPULAR CATEGORIES — Swiggy-style tile lane
          ══════════════════════════════════════════════ */}
      <section className="py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2>
              <span className="text-orange-500 mr-1.5">•</span>
              Popular Categories
            </h2>
            <Link to="/search" className="flex items-center gap-0.5">
              See all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="lane">
            {CATEGORIES.map((cat) => (
              <CategoryTile key={cat.name} cat={cat} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          TOP RATED SHOPS — Horizontal lane
          ══════════════════════════════════════════════ */}
      {!loading && topRated.length > 0 && (
        <section className="py-6 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="section-header">
              <h2>
                <span className="text-orange-500 mr-1.5">✦</span>
                Top Rated Shops
              </h2>
              <Link to="/#shops" className="flex items-center gap-0.5">
                See all <ChevronRight size={14} />
              </Link>
            </div>
            <div className="lane">
              {topRated.slice(0, 8).map((shop) => (
                <ShopCard key={shop._id} shop={shop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          OFFERS BANNER — Yellow accent
          ══════════════════════════════════════════════ */}
      <section className="py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl overflow-hidden relative">
            <div className="banner-orange px-6 py-8 md:py-10 relative overflow-hidden">
              {/* Decorative dots */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-300 text-orange-700 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3">
                    <Percent size={12} /> Limited Time
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white">
                    First order? Get <span className="text-yellow-200">₹100 off!</span>
                  </h2>
                  <p className="text-white/80 text-sm mt-1">Use code: <span className="font-bold text-yellow-200 bg-white/20 px-2 py-0.5 rounded">KALNA100</span> on orders above ₹499</p>
                </div>
                <button className="bg-white text-orange-500 font-bold px-6 py-3 rounded-lg text-sm hover:bg-orange-50 transition-all shadow-lg whitespace-nowrap">
                  Order Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          OPEN NOW — Quick lane
          ══════════════════════════════════════════════ */}
      {openShops.length > 0 && (
        <section className="py-6 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="section-header">
              <h2>
                <span className="text-green-500 mr-1.5">●</span>
                Open Now
              </h2>
              <span className="text-xs font-semibold text-gray-500">{openShops.length} shops</span>
            </div>
            <div className="lane">
              {openShops.slice(0, 8).map((shop) => (
                <ShopCard key={shop._id} shop={shop} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════
          SHOPS GRID — Full grid view (filtered)
          ══════════════════════════════════════════════ */}
      <section id="shops" className="py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                {searchTerm ? `Results for "${searchTerm.slice(0, 40)}"` : "All Shops"}
              </p>
              <h2 className="!text-lg !font-bold text-gray-800 mt-0.5">
                {searchTerm ? "Search Results" : "Delivery near you"}
              </h2>
            </div>
            {!searchTerm && !loading && (
              <span className="text-xs text-gray-500">{restaurants.length} shops</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 size={32} className="animate-spin text-orange-500" />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
              <ShoppingBag size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-semibold text-gray-600">No shops found</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {filteredRestaurants.map((shop) => (
                <ShopCard key={shop._id} shop={shop} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── ORDER AGAIN ──────────────────────────────── */}
      {userInfo && <OrderAgain />}

      {/* ── RECOMMENDATIONS ──────────────────────────── */}
      {recommendations.length > 0 && (
        <section className="py-6 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="section-header">
              <h2>
                <Sparkles size={18} className="inline text-orange-500 mr-1.5" />
                Recommended For You
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recommendations.map((rec, idx) => (
                <Link
                  key={rec._id?.toString() || idx}
                  to={`/restaurant/${rec.restaurant}`}
                  className="group card-swiggy-hard overflow-hidden !p-0"
                >
                  <div className="h-24 overflow-hidden bg-gray-100">
                    <img src={rec.image || "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300"} alt={rec.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">{rec.name}</p>
                    {rec.reason && <p className="text-[10px] font-medium text-orange-500 mt-0.5">{rec.reason}</p>}
                    {rec.price > 0 && <p className="text-xs font-bold text-gray-600 mt-0.5">₹{rec.price}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── APP BANNER ────────────────────────────────── */}
      <section className="banner-charcoal py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-white text-center sm:text-left">
              <h2 className="text-xl font-bold">Get the Kalna Liquor app</h2>
              <p className="text-sm text-gray-400 mt-0.5">Faster checkout, live tracking, exclusive offers</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-white text-gray-800 font-bold rounded-lg text-sm hover:bg-gray-100 transition-all">
                Download Now
              </button>
              <button className="px-5 py-2.5 border border-white/30 text-white font-bold rounded-lg text-sm hover:bg-white/10 transition-all">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Home;