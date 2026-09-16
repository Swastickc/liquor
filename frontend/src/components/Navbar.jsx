import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart,
  User,
  Menu,
  X,
  LogOut,
  Search,
  Bell,
  Globe,
  MapPin,
  ChevronDown,
  Package,
  LayoutDashboard,
  ChefHat,
  Truck,
  Crown,
  Trophy,
  Calendar,
  Users,
  Shield,
  Gift,
} from "lucide-react";
import { BASEURL } from "../config";
import { disconnectSocket } from "../utils/socket";
import { logout } from "../redux/userSlice";
import InstallPWA from "./InstallPWA";

const CATEGORIES = [
  { name: "Whisky", emoji: "🥃" },
  { name: "Vodka", emoji: "🍸" },
  { name: "Rum", emoji: "🍹" },
  { name: "Beer", emoji: "🍺" },
  { name: "Wine", emoji: "🍷" },
  { name: "Brandy", emoji: "🥂" },
  { name: "Gin", emoji: "🍸" },
  { name: "Sake", emoji: "🍶" },
];

const Navbar = () => {
  const { t, i18n } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const { cartItems } = useSelector((state) => state.cart);
  const { userInfo } = useSelector((state) => state.user);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setLangOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  useEffect(() => {
    if (!userInfo) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${BASEURL}/api/v1/notifications/my`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch { /* noop */ }
    };
    fetchNotifs();
    const interval = setInterval(() => {
      if (!document.hidden) fetchNotifs();
    }, 30000);
    return () => clearInterval(interval);
  }, [userInfo]);

  const logoutHandler = async () => {
    try {
      await fetch(`${BASEURL}/api/v1/users/logout`, {
        method: "POST", credentials: "include",
      });
    } catch { /* noop */ }
    dispatch(logout());
    dispatch({ type: "cart/logout" });
    disconnectSocket();
    setIsOpen(false);
    navigate("/login");
  };

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="fixed w-full z-50 top-0 bg-background/90 backdrop-blur-lg border-b border-border transition-all duration-300">
      {/* ─── TOP BAR ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-3 md:gap-6">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 -ml-2 text-foreground hover:text-accent transition-colors"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* LOGO */}
          <Link to="/" className="flex items-center gap-1 shrink-0" onClick={closeMenu}>
            <span className="text-xl md:text-2xl font-display font-extrabold tracking-tight text-foreground">
              Kalna<span className="text-accent">Liquor</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 animate-pulse" />
          </Link>

          {/* ─── SEARCH BAR (Desktop) ─────────────────── */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex flex-1 max-w-xl mx-auto"
          >
            <div className="relative w-full">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                placeholder='Search for Whisky, Rum, Beer...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              />
            </div>
          </form>

          {/* ─── RIGHT ICONS ──────────────────────────── */}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            {/* Language */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setLangOpen((p) => !p)}
                className="p-2 text-muted-foreground hover:text-accent transition-colors rounded-lg hover:bg-surface"
              >
                <Globe size={20} />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-36 bg-surface border border-border rounded-xl shadow-float z-50 overflow-hidden">
                  <button onClick={() => changeLanguage("en")} className={`w-full px-4 py-3 text-left text-sm hover:bg-background transition-colors ${i18n.language === "en" ? "text-accent font-bold" : "text-foreground"}`}>English</button>
                  <button onClick={() => changeLanguage("hi")} className={`w-full px-4 py-3 text-left text-sm hover:bg-background transition-colors ${i18n.language === "hi" ? "text-accent font-bold" : "text-foreground"}`}>हिन्दी</button>
                </div>
              )}
            </div>

            {/* Notifications (logged in only) */}
            {userInfo && (
              <div className="relative hidden sm:block">
                <button onClick={() => setNotifOpen((p) => !p)} className="relative p-2 text-muted-foreground hover:text-accent transition-colors rounded-lg hover:bg-surface">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-accent text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-float z-50 overflow-hidden">
                    <div className="p-3 border-b border-border flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-foreground uppercase tracking-widest">Notifications</span>
                      <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No notifications</p>
                      ) : (
                        notifications.slice(0, 5).map((n) => (
                          <div key={n._id} className={`px-3 py-2 border-b border-border/50 hover:bg-background cursor-pointer ${n.read ? "opacity-60" : ""}`} onClick={() => { if (n.data?.orderId) navigate(`/order/${n.data.orderId}`); setNotifOpen(false); }}>
                            <p className="text-xs font-bold text-foreground">{n.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{n.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-muted-foreground hover:text-accent transition-colors rounded-lg hover:bg-surface">
              <ShoppingCart size={22} />
              {cartItems.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-md px-1">
                  {cartItems.reduce((acc, item) => acc + item.qty, 0)}
                </span>
              )}
            </Link>

            {/* User */}
            {userInfo ? (
              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:border-accent/40 hover:bg-surface transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                  <User size={14} className="text-accent" />
                </div>
                <span className="text-sm font-semibold text-foreground max-w-[80px] truncate">
                  {userInfo.name?.split(" ")[0] || "User"}
                </span>
              </Link>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login" className="text-sm font-semibold text-foreground hover:text-accent px-4 py-2 transition-colors">Log In</Link>
                <Link to="/register" className="text-sm font-bold text-white bg-accent hover:bg-accent-light px-4 py-2 rounded-xl transition-all shadow-accent/20 hover:shadow-accent/40">Sign Up</Link>
              </div>
            )}

            {/* Mobile icons */}
            <div className="flex md:hidden items-center gap-1">
              <InstallPWA />
              {userInfo ? (
                <Link to="/profile" className="p-2 text-muted-foreground">
                  <User size={20} />
                </Link>
              ) : (
                <Link to="/login" className="p-2 text-muted-foreground">
                  <User size={20} />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ─── MOBILE SEARCH BAR ─────────────────────── */}
        <form onSubmit={handleSearch} className="md:hidden pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search products, shops..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent transition-all"
            />
          </div>
        </form>
      </div>

      {/* ─── CATEGORY PILLS ──────────────────────────── */}
      <div className="hidden md:block border-t border-border/50 bg-background/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-none">
            <Link to="/" className="px-4 py-1.5 rounded-full text-xs font-semibold bg-accent text-white shrink-0">
              All
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to={`/?category=${cat.name.toLowerCase()}`}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border shrink-0 transition-all whitespace-nowrap"
              >
                <span>{cat.emoji}</span>
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ─── DELIVERY INFO BAR ───────────────────────── */}
      <div className="border-t border-border/40 bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin size={12} className="text-accent" />
            Delivering to Kalna, West Bengal
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="flex items-center gap-1">
            <Package size={12} className="text-accent" />
            30-45 min delivery
          </span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="flex items-center gap-1">
            <Shield size={12} className="text-accent" />
            21+ Only
          </span>
        </div>
      </div>

      {/* ─── MOBILE SIDEBAR ──────────────────────────── */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={closeMenu} />
          <div className="fixed top-0 left-0 h-full w-72 bg-surface border-r border-border z-50 md:hidden overflow-y-auto animate-slide-right">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <Link to="/" className="text-lg font-display font-extrabold text-foreground" onClick={closeMenu}>
                Kalna<span className="text-accent">Liquor</span>
              </Link>
              <button onClick={closeMenu} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-1">
              {/* Category header */}
              <p className="px-3 py-2 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Categories</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {CATEGORIES.map((cat) => (
                  <Link key={cat.name} to={`/?category=${cat.name.toLowerCase()}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-surface-raised border border-border hover:border-accent/30 transition-all" onClick={closeMenu}>
                    <span>{cat.emoji}</span> {cat.name}
                  </Link>
                ))}
              </div>

              <div className="border-t border-border my-3" />

              <Link to="/" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>Home</Link>

              {userInfo ? (
                <>
                  {userInfo.role === "admin" && (
                    <Link to="/admin/dashboard" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-accent hover:bg-surface-raised transition-colors" onClick={closeMenu}>
                      <LayoutDashboard size={18} /> Admin Panel
                    </Link>
                  )}
                  {userInfo.role === "restaurant_owner" && (
                    <Link to="/restaurant/dashboard" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-accent hover:bg-surface-raised transition-colors" onClick={closeMenu}>
                      <ChefHat size={18} /> Dashboard
                    </Link>
                  )}
                  {userInfo.role === "delivery_partner" && (
                    <Link to="/delivery/dashboard" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>
                      <Truck size={18} /> Delivery Dashboard
                    </Link>
                  )}
                  <Link to="/myorders" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>
                    <Package size={18} /> My Orders
                  </Link>
                  <Link to="/profile" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>
                    <User size={18} /> Profile
                  </Link>

                  <div className="border-t border-border my-3" />

                  <Link to="/about" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>About Us</Link>
                  <Link to="/contact" className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-muted-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>Contact</Link>

                  <div className="border-t border-border my-3" />

                  <button onClick={logoutHandler} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold text-danger hover:bg-danger/10 transition-colors">
                    <LogOut size={18} /> Logout
                  </button>
                </>
              ) : (
                <div className="space-y-2 mt-4">
                  <Link to="/login" className="block w-full text-center py-3 border border-border rounded-xl font-bold text-foreground hover:bg-surface-raised transition-colors" onClick={closeMenu}>Log In</Link>
                  <Link to="/register" className="block w-full text-center py-3 bg-accent text-white rounded-xl font-bold shadow-md hover:bg-accent-light transition-all" onClick={closeMenu}>Sign Up</Link>
                </div>
              )}

              <div className="border-t border-border my-4" />
              <p className="px-3 py-1 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Language</p>
              <div className="flex gap-2 px-3 pt-1">
                <button onClick={() => changeLanguage("en")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${i18n.language === "en" ? "bg-accent text-white" : "bg-surface-raised text-foreground"}`}>English</button>
                <button onClick={() => changeLanguage("hi")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${i18n.language === "hi" ? "bg-accent text-white" : "bg-surface-raised text-foreground"}`}>हिन्दी</button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
};

export default Navbar;