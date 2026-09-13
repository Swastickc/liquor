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
  LayoutDashboard,
  ChefHat,
  Truck,
  Package,
  Bell,
  Globe,
  Crown,
  Trophy,
  Calendar,
  Shield,
  Users,
} from "lucide-react";
import { BASEURL } from "../config";
import { disconnectSocket } from "../utils/socket";
import { logout } from "../redux/userSlice";

import InstallPWA from "./InstallPWA";

const Navbar = () => {
  const { t, i18n } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { cartItems } = useSelector((state) => state.cart);
  const { userInfo } = useSelector((state) => state.user);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setLangOpen(false);
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
      } catch {
        // silently fail
      }
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
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Proceed with frontend logout
    }
    dispatch(logout());
    dispatch({ type: "cart/logout" });
    disconnectSocket();
    setIsOpen(false);
    navigate("/login");
  };

  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="bg-background/80 backdrop-blur-md text-foreground border-b border-border fixed w-full z-50 top-0 pt-[env(safe-area-inset-top)] md:pt-0 transition-all duration-300 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* LOGO */}
          <Link
            to="/"
            className="text-xl md:text-2xl font-display font-extrabold text-foreground tracking-tight flex items-center"
            onClick={closeMenu}
          >
            Kalna<span className="text-accent">Liquor</span>
            <span className="w-2 h-2 rounded-full bg-accent mt-4 ml-1 animate-pulse"></span>
          </Link>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-muted-foreground hover:text-accent font-medium transition-colors"
            >
              {t("home")}
            </Link>

            <InstallPWA />

            {userInfo ? (
              <>
                {userInfo.role === "admin" && (
                  <Link
                    to="/admin/dashboard"
                    className="text-muted-foreground hover:text-accent transition-colors font-medium"
                  >
                    {t("adminPanel")}
                  </Link>
                )}
                {userInfo.role === "restaurant_owner" && (
                  <Link
                    to="/restaurant/dashboard"
                    className="text-muted-foreground hover:text-accent transition-colors font-medium"
                  >
                    {t("kitchenDashboard")}
                  </Link>
                )}
                {userInfo.role === "delivery_partner" && (
                  <Link
                    to="/delivery/dashboard"
                    className="text-muted-foreground hover:text-accent transition-colors font-medium"
                  >
                    {t("deliveryDashboard")}
                  </Link>
                )}
                {userInfo.role === "user" && (
                  <Link
                    to="/myorders"
                    className="text-muted-foreground hover:text-accent transition-colors font-medium"
                  >
                    {t("myOrders")}
                  </Link>
                )}

                {/* Notification Bell */}
                <div className="relative">
                  <button
                    onClick={() => setNotifOpen((p) => !p)}
                    className="relative text-muted-foreground hover:text-accent transition-colors"
                  >
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-border flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-widest">{t("notifications")}</span>
                        <button
                          onClick={() => setNotifOpen(false)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">{t("noNotifications")}</p>
                        ) : (
                          notifications.slice(0, 5).map((n) => (
                            <div
                              key={n._id}
                              className={`px-3 py-2 border-b border-border/50 hover:bg-muted cursor-pointer ${n.read ? "opacity-60" : ""}`}
                              onClick={() => {
                                if (n.data?.orderId) navigate(`/order/${n.data.orderId}`);
                                setNotifOpen(false);
                              }}
                            >
                              <p className="text-[10px] font-bold text-foreground">{n.title}</p>
                              <p className="text-[9px] text-muted-foreground truncate">{n.body}</p>
                            </div>
                          ))
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="p-2 border-t border-border text-center bg-muted">
                          <button
                            onClick={async () => {
                              try {
                                await fetch(`${BASEURL}/api/v1/notifications/read`, {
                                  method: "PATCH",
                                  credentials: "include",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ ids: "all" }),
                                });
                                setUnreadCount(0);
                                setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                              } catch {
                                // no-op
                              }
                            }}
                            className="text-[9px] font-mono font-bold text-accent hover:text-accent-light uppercase tracking-widest"
                          >
                            {t("markAllRead")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Link
                  to="/profile"
                  className="flex items-center gap-2 bg-card px-4 py-2 rounded-full border border-border hover:border-accent hover:shadow-accent transition-all"
                >
                  <User size={18} className="text-foreground" />
                  <span className="text-sm font-bold truncate max-w-[100px] text-foreground">
                    {userInfo.name?.split(" ")[0] || "User"}
                  </span>
                </Link>

                <button
                  onClick={logoutHandler}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                  title={t("logout")}
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <div className="flex gap-4">
                <Link
                  to="/login"
                  className="text-foreground hover:text-accent font-bold py-2 transition-colors"
                >
                  {t("login")}
                </Link>
                <Link
                  to="/register"
                  className="bg-accent-gradient text-white px-5 py-2 rounded-lg font-bold hover:-translate-y-0.5 active:scale-[0.98] shadow-md hover:shadow-accent transition-all text-sm"
                >
                  {t("signUp")}
                </Link>
              </div>
            )}

            {/* Language Toggle */}
            <div className="relative">
              <button
                onClick={() => setLangOpen((p) => !p)}
                className="text-muted-foreground hover:text-accent transition-colors"
              >
                <Globe size={20} />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => changeLanguage("en")}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors ${i18n.language === "en" ? "text-accent font-bold" : "text-foreground"}`}
                  >
                    {t("english")}
                  </button>
                  <button
                    onClick={() => changeLanguage("hi")}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors ${i18n.language === "hi" ? "text-accent font-bold" : "text-foreground"}`}
                  >
                    {t("hindi")}
                  </button>
                </div>
              )}
            </div>

            <Link
              to="/cart"
              className="relative group p-2"
            >
              <ShoppingCart
                size={24}
                className="text-muted-foreground group-hover:text-accent transition-colors"
              />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md">
                  {cartItems.reduce((acc, item) => acc + item.qty, 0)}
                </span>
              )}
            </Link>
          </div>

          {/* MOBILE MENU BUTTONS */}
          <div className="flex items-center gap-2 md:hidden">
            <InstallPWA />

            <Link
              to="/cart"
              className="relative p-2"
              onClick={closeMenu}
            >
              <ShoppingCart size={22} className="text-foreground" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md">
                  {cartItems.reduce((acc, item) => acc + item.qty, 0)}
                </span>
              )}
            </Link>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-foreground focus:outline-none p-2 active:scale-90 transition-transform"
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                <Menu
                  size={24}
                  className={`absolute transition-all duration-300 ${
                    isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
                  }`}
                />
                <X
                  size={24}
                  className={`absolute transition-all duration-300 ${
                    isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DROPDOWN */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
            onClick={closeMenu}
          />
          <div className="relative z-50 md:hidden bg-card border-b border-border shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 pt-2 pb-6 space-y-2">
              <Link
                to="/"
                className="block px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted hover:text-accent transition-colors"
                onClick={closeMenu}
              >
                {t("home")}
              </Link>

              {userInfo ? (
                <>
                  {userInfo.role === "admin" && (
                    <Link
                      to="/admin/dashboard"
                      className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-bold text-accent hover:bg-muted transition-colors"
                      onClick={closeMenu}
                    >
                      <LayoutDashboard size={18} /> {t("adminPanel")}
                    </Link>
                  )}

                  {userInfo.role === "restaurant_owner" && (
                    <Link
                      to="/restaurant/dashboard"
                      className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-bold text-accent hover:bg-muted transition-colors"
                      onClick={closeMenu}
                    >
                      <ChefHat size={18} /> {t("kitchenDashboard")}
                    </Link>
                  )}

                  {userInfo.role === "delivery_partner" && (
                    <Link
                      to="/delivery/dashboard"
                      className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-bold text-foreground hover:bg-muted transition-colors"
                      onClick={closeMenu}
                    >
                      <Truck size={18} /> {t("deliveryDashboard")}
                    </Link>
                  )}

                  {userInfo.role === "user" && (
                    <Link
                      to="/myorders"
                      className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted transition-colors"
                      onClick={closeMenu}
                    >
                      <Package size={18} /> {t("myOrders")}
                    </Link>
                  )}

                  <div className="border-t border-border my-2" />

                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted hover:text-accent transition-colors"
                    onClick={closeMenu}
                  >
                    <User size={18} /> {t("profile")} ({userInfo.name || "User"})
                  </Link>

                  {userInfo.role === "user" && (
                    <>
                      <div className="border-t border-border my-2" />
                      <Link
                        to="/swadpass"
                        className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted transition-colors"
                        onClick={closeMenu}
                      >
                        <Crown size={18} className="text-accent" /> SwadPass
                      </Link>
                      <Link
                        to="/rewards"
                        className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted transition-colors"
                        onClick={closeMenu}
                      >
                        <Trophy size={18} className="text-accent" /> Rewards
                      </Link>
                      <Link
                        to="/reservations"
                        className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted transition-colors"
                        onClick={closeMenu}
                      >
                        <Calendar size={18} /> Reservations
                      </Link>
                      <Link
                        to="/group-orders"
                        className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground hover:bg-muted transition-colors"
                        onClick={closeMenu}
                      >
                        <Users size={18} /> Group Orders
                      </Link>
                    </>
                  )}

                  <div className="border-t border-border my-2" />

                  <Link
                    to="/privacy"
                    className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-muted-foreground hover:bg-muted transition-colors"
                    onClick={closeMenu}
                  >
                    <Shield size={18} /> Privacy & Data
                  </Link>

                  <div className="border-t border-border pt-3 mt-3">
                    <p className="px-3 py-1 text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest">{t("language")}</p>
                    <div className="flex gap-2 px-3 pt-1">
                      <button onClick={() => changeLanguage("en")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${i18n.language === "en" ? "bg-accent-gradient text-white shadow-md shadow-accent/20" : "bg-muted text-foreground"}`}>English</button>
                      <button onClick={() => changeLanguage("hi")} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${i18n.language === "hi" ? "bg-accent-gradient text-white shadow-md shadow-accent/20" : "bg-muted text-foreground"}`}>हिन्दी</button>
                    </div>
                  </div>

                  <div className="border-t border-border my-2" />

                  <div className="flex items-center gap-2 px-3 py-3 rounded-xl text-base font-medium text-foreground">
                    <Bell size={18} />
                    {t("notifications")}
                    {unreadCount > 0 && (
                      <span className="ml-auto bg-accent text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="border-t border-border my-2" />

                  <button
                    onClick={logoutHandler}
                    className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-base font-bold text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={18} /> {t("logout")}
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4 mt-4 px-2">
                  <Link
                    to="/login"
                    className="text-center py-3 border border-border rounded-xl font-bold hover:bg-muted text-foreground transition-colors"
                    onClick={closeMenu}
                  >
                    {t("login")}
                  </Link>
                  <Link
                    to="/register"
                    className="text-center py-3 bg-accent-gradient text-white rounded-xl font-bold shadow-md hover:shadow-accent transition-all"
                    onClick={closeMenu}
                  >
                    {t("signUp")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar;
