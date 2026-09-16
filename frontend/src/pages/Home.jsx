import React, { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  Search, MapPin, Clock, Star, ArrowRight, Loader2,
  Trophy, Sparkles, Shield, ChevronRight,
  ShoppingBag, Timer, Store, Truck, Award,
  BadgeCheck, ChevronDown,
} from "lucide-react";
import { BASEURL } from "../config";
import { getSocket } from "../utils/socket.js";
import PageSEO from "../components/SEO/PageSEO";
import { toJsonLd, localBusinessSchema, breadcrumbSchema } from "../utils/structuredData";
import OrderAgain from "../components/OrderAgain";
import { toast } from "react-hot-toast";

const VoiceSearch = lazy(() => import("../components/VoiceSearch"));

/* ─── Categories ─── */
const CATEGORIES = [
  { name: "Whisky", emoji: "🥃" },
  { name: "Vodka", emoji: "🍸" },
  { name: "Rum", emoji: "🍹" },
  { name: "Beer", emoji: "🍺" },
  { name: "Wine", emoji: "🍷" },
  { name: "Brandy", emoji: "🥂" },
  { name: "Gin", emoji: "🍸" },
  { name: "Champagne", emoji: "🍾" },
];

/* ─── Shop Card (Swiggy-style) ─── */
function ShopCard({ shop }) {
  const ratingColor = shop.rating >= 4.0 ? "#48c479" : shop.rating >= 3.0 ? "#f7a742" : "#e0364a";

  return (
    <Link
      to={`/restaurant/${shop._id}`}
      className="group block rounded-2xl overflow-hidden transition-all duration-200 bg-white border border-gray-100 hover:shadow-lg hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden bg-gray-100">
        <img
          src={shop.image
            ? `${BASEURL}/api/v1/image/thumbnail?url=${encodeURIComponent(shop.image)}&w=400&q=75&fit=cover`
            : "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"
          }
          alt={shop.name || "Shop"}
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400&q=70&fm=webp&fit=crop"; }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Open/Closed badge */}
        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider text-white shadow-sm ${
          shop.isOpenNow ? "bg-green-500" : "bg-gray-500"
        }`}>
          {shop.isOpenNow ? "Open" : "Closed"}
        </div>

        {/* Rating badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-white shadow-sm" style={{ backgroundColor: ratingColor }}>
          <Star size={12} fill="currentColor" stroke="none" />
          <span>{shop.rating > 0 ? shop.rating.toFixed(1) : "NEW"}</span>
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base text-gray-800 group-hover:text-orange-500 transition-colors line-clamp-1">
            {shop.name || "Shop"}
          </h3>
          {shop.performanceScore > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-gray-500 shrink-0">
              <Trophy size={10} className="text-orange-500" />
              {shop.performanceScore}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
          <MapPin size={12} className="text-gray-400 shrink-0" />
          <span className="line-clamp-1">Kalna, West Bengal</span>
        </div>

        {/* Delivery info */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={12} className="text-gray-400" />
            <span>30–45 min</span>
          </div>
          <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
            <BadgeCheck size={12} /> Free delivery
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={(e) => { e.preventDefault(); window.location.href = `/restaurant/${shop._id}`; }}
          className="mt-3 w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-orange-500 bg-orange-50 border border-orange-100 hover:bg-orange-500 hover:text-white transition-all"
        >
          View Shop
        </button>
      </div>
    </Link>
  );
}

/* ─── Home Page ─── */
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
      setFilteredRestaurants(restaurants.filter((s) => s.name && s.name.toLowerCase().includes(q)));
    }
  }, [searchTerm, restaurants]);

  useEffect(() => {
    const urlSearch = searchParams.get("search");
    if (urlSearch) setSearchTerm(urlSearch);
  }, [searchParams]);

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

      {/* ── TOP SEARCH BAR ────────────────────────────── */}
      <section className="bg-gradient-to-b from-orange-50 to-white pt-20 pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4">
            {/* Location bar */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={16} className="text-orange-500" />
              <span className="font-medium">Kalna, West Bengal</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div>

            {/* Search */}
            <div className="relative max-w-2xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search for Whisky, Rum, Beer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-12 py-3.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
                aria-label="Search shops"
              />
              <Suspense fallback={null}>
                <VoiceSearch setSearchTerm={setSearchTerm} />
              </Suspense>
            </div>

            {/* Hero content */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-orange-600 uppercase tracking-wider">
                  <Shield size={13} />
                  21+ Only — Valid ID Required
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mt-2">
                  Premium spirits, <span className="text-orange-500">delivered.</span>
                </h1>
              </div>
              <div className="flex gap-2">
                <a href="#shops" className="btn-primary text-sm px-5 py-2.5">
                  Browse Shops <ArrowRight size={16} />
                </a>
                {!userInfo && (
                  <Link to="/register" className="btn-outline text-sm px-5 py-2.5">
                    Sign Up
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY CHIPS ────────────────────────────── */}
      <section className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to={`/?category=${cat.name.toLowerCase()}`}
                className="chip shrink-0"
              >
                <span>{cat.emoji}</span> {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ─────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Shield, text: "Age Verified 21+", sub: "Valid ID required" },
              { icon: Timer, text: "10 AM – 10 PM", sub: "Daily delivery" },
              { icon: Store, text: "Licensed Shops", sub: "Govt. approved" },
              { icon: Truck, text: "30-45 min", sub: "Real-time tracking" },
            ].map(({ icon: Icon, text, sub }) => (
              <div key={text} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{text}</p>
                  <p className="text-[11px] text-gray-500">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BANNER ──────────────────────────────── */}
      <section className="bg-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Licensed Shops", value: restaurants.length || "—" },
              { label: "Avg. Delivery",  value: "30 min" },
              { label: "Delivery Hours", value: "10AM–10PM" },
              { label: "Min. Age",       value: "21 Years" },
            ].map(({ label, value }) => (
              <div key={label} className="text-center text-white">
                <p className="text-xl font-bold">{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-100">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHOPS GRID ────────────────────────────────── */}
      <section id="shops" className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                {searchTerm ? `Results for "${searchTerm.slice(0, 40)}"` : "Delivery near you"}
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mt-1">
                {searchTerm ? "Search Results" : "Top Shops"}
              </h2>
            </div>
            {!searchTerm && restaurants.length > 0 && (
              <span className="text-xs text-gray-500 hidden sm:block">
                {restaurants.length} shop{restaurants.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 size={32} className="animate-spin text-orange-500" />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-white">
              <ShoppingBag size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-lg font-semibold text-gray-600">No shops found</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search</p>
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
        <section className="py-8 bg-white border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={18} className="text-orange-500" />
              <h2 className="text-xl font-bold text-gray-800">Recommended For You</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {recommendations.map((rec, idx) => (
                <Link
                  key={rec._id?.toString() || idx}
                  to={`/restaurant/${rec.restaurant}`}
                  className="group rounded-xl overflow-hidden border border-gray-100 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="h-24 overflow-hidden bg-gray-100">
                    <img src={rec.image || "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300"} alt={rec.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-semibold text-gray-800 truncate">{rec.name}</p>
                    {rec.reason && <p className="text-[10px] font-medium text-orange-500 mt-0.5">{rec.reason}</p>}
                    {rec.price > 0 && <p className="text-xs mt-0.5 font-bold text-gray-600">₹{rec.price}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── APP BANNER ────────────────────────────────── */}
      <section className="py-8 bg-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-white text-center sm:text-left">
              <h2 className="text-xl font-bold">Get the Kalna Liquor app</h2>
              <p className="text-sm text-orange-100 mt-1">Order faster, track in real-time</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-white text-orange-500 font-bold rounded-lg text-sm hover:bg-orange-50 transition-all">
                Download Now
              </button>
              <button className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg text-sm hover:bg-orange-700 transition-all">
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