import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Leaf,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { categories, products as initialProducts, money } from "./data";
import Studio from "./Studio";
import { backend, isLive, loadCatalog, saveProduct } from "./backend";
import { Account, Checkout } from "./Commerce";
import { filterProducts, cartTotals } from "./catalog";
import "./styles.css";
import PwaStatus from "./PwaStatus";
import { getSettings, openNow } from "./settings";
import Storefront from "./Storefront";
import Delivery from "./Delivery";
import ErrorBoundary from "./ErrorBoundary";

function ProductArt({ product, hero = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image]);
  return product.image && !failed ? (
    <img
      className={hero ? "hero-product" : "product-art"}
      src={product.image}
      alt={product.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="photo-placeholder">
      <ShoppingBag size={32} />
      <span>Product photo</span>
    </div>
  );
}
function App() {
  const [storeSettings, setStoreSettings] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      getSettings()
        .then((s) => {
          if (active) setStoreSettings(s);
        })
        .catch(() => {
          if (active) setStoreSettings(null);
        });
    const connection = () => setOnline(navigator.onLine);
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("store-settings-changed", refresh);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("store-settings-changed", refresh);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  const acceptingOrders = online && openNow(storeSettings);

  const [products, setProducts] = useState(() => {
    if (isLive) return [];
    try {
      const saved = JSON.parse(
        localStorage.getItem("kalna-grocery-catalog-v2"),
      );
      return Array.isArray(saved) &&
        saved.length &&
        saved.every(
          (p) =>
            p.id && p.name && p.brand && p.category && Number.isFinite(p.price),
        )
        ? saved
        : initialProducts;
    } catch {
      return initialProducts;
    }
  });
  const [driver, setDriver] = useState(window.location.hash === "#driver");
  const [admin, setAdmin] = useState(window.location.hash === "#studio");
  const [account, setAccount] = useState(window.location.hash === "#account");
  const [catalogError, setCatalogError] = useState(""),
    [catalogLoading, setCatalogLoading] = useState(isLive);
  const [checkingOut, setCheckingOut] = useState(false);
  useEffect(() => {
    const sync = () => {
      setDriver(window.location.hash === "#driver");
      setAdmin(window.location.hash === "#studio");
      setAccount(window.location.hash === "#account");
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  async function refreshCatalog() {
    if (!isLive) return;
    setCatalogLoading(true);
    setCatalogError("");
    try {
      setProducts(await loadCatalog());
    } catch {
      setCatalogError(
        "The catalog is temporarily unavailable. Please try again.",
      );
    } finally {
      setCatalogLoading(false);
    }
  }
  useEffect(() => {
    if (!backend) return;
    refreshCatalog();
    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange(() => {
      setTimeout(refreshCatalog, 0);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function saveCatalog(next, changed) {
    if (isLive) {
      await saveProduct(changed);
      await refreshCatalog();
      return true;
    }
    try {
      localStorage.setItem("kalna-grocery-catalog-v2", JSON.stringify(next));
      setProducts(next);
      return true;
    } catch {
      return false;
    }
  }
  const [category, setCategory] = useState(categories[0]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const [cart, setCart] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("kalna-bag-v1") || "{}");
      return Object.fromEntries(
        Object.entries(saved).filter(
          ([id, qty]) =>
            id.length <= 100 && Number.isInteger(qty) && qty > 0 && qty <= 20,
        ),
      );
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("kalna-bag-v1", JSON.stringify(cart));
    } catch {}
  }, [cart]);
  const [cartOpen, setCartOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dialogRef = useRef(null),
    cartButtonRef = useRef(null);
  const { count: totalCount, subtotal } = cartTotals(products, cart);
  const visible = filterProducts(products, category, query, sort);
  function changeQty(p, amount) {
    setCart((prev) => ({
      ...prev,
      [p.id]: Math.max(
        0,
        Math.min(p.stock ?? 20, 20, (prev[p.id] || 0) + amount),
      ),
    }));
    setAnnouncement(`${p.name}: quantity updated`);
  }
  function browse(next = categories[0]) {
    setCategory(next);
    setQuery("");
    document.getElementById("essentials").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  useEffect(() => {
    if (!dialogRef.current) return;
    if (cartOpen) dialogRef.current.showModal();
    else if (dialogRef.current.open) dialogRef.current.close();
  }, [cartOpen]);
  function closeCart() {
    setCheckingOut(false);
    setCartOpen(false);
    cartButtonRef.current?.focus();
  }
  if (driver) return <Delivery />;
  if (account && isLive)
    return (
      <Account
        onBack={() => {
          window.location.hash = "";
          setAccount(false);
        }}
      />
    );
  if (admin)
    return (
      <Studio
        products={products}
        onSave={saveCatalog}
        onBack={() => {
          window.location.hash = "";
          setAdmin(false);
        }}
        ProductArt={ProductArt}
      />
    );
  return (
    <div className="min-h-screen bg-white text-ink">
      <a href="#essentials" className="skip-link">
        Skip to products
      </a>
      <Storefront
        storeSettings={storeSettings}
        acceptingOrders={acceptingOrders}
        products={products}
        visible={visible}
        category={category}
        setCategory={setCategory}
        query={query}
        setQuery={setQuery}
        sort={sort}
        setSort={setSort}
        cart={cart}
        totalCount={totalCount}
        subtotal={subtotal}
        changeQty={changeQty}
        browse={browse}
        isLive={isLive}
        catalogLoading={catalogLoading}
        catalogError={catalogError}
        refreshCatalog={refreshCatalog}
        openCart={() => setCartOpen(true)}
        cartButtonRef={cartButtonRef}
        ProductArt={ProductArt}
      />
      <PwaStatus />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}. Bag contains {totalCount} items.
      </p>
      <dialog
        ref={dialogRef}
        onCancel={closeCart}
        onClose={() => setCartOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeCart();
        }}
        className="cart-dialog"
        aria-labelledby="bag-title"
      >
        <div className="flex h-full flex-col bg-white p-6">
          <div className="flex items-center justify-between border-b pb-5">
            <div>
              <p className="text-xs text-muted">KALNA DAILY</p>
              <h2 id="bag-title" className="mt-1 text-2xl font-semibold">
                Your bag{" "}
                <span className="text-base text-muted">({totalCount})</span>
              </h2>
            </div>
            <button
              autoFocus
              aria-label="Close bag"
              className="rounded-md p-3 hover:bg-cream"
              onClick={closeCart}
            >
              <X size={20} />
            </button>
          </div>
          {checkingOut ? (
            <div className="overflow-y-auto py-6">
              <Checkout
                cart={cart}
                products={products}
                settings={storeSettings}
                onSuccess={() => {
                  setCart({});
                  refreshCatalog();
                }}
                onBack={() => setCheckingOut(false)}
              />
            </div>
          ) : totalCount ? (
            <>
              <div className="flex-1 overflow-y-auto">
                {products
                  .filter((p) => cart[p.id] > 0 && p.active !== false)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 border-b py-4"
                    >
                      <div className="w-16 shrink-0 rounded bg-cream">
                        <ProductArt product={p} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold">{p.name}</h3>
                        <p className="my-1 text-xs text-muted">{p.size}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">
                            {money(p.price * cart[p.id])}
                          </span>
                          <div className="flex items-center rounded border">
                            <button
                              className="quantity-button"
                              aria-label={`Decrease ${p.name} in bag`}
                              onClick={() => changeQty(p, -1)}
                            >
                              <Minus size={13} />
                            </button>
                            <span className="text-xs">{cart[p.id]}</span>
                            <button
                              disabled={
                                cart[p.id] >= Math.min(p.stock ?? 20, 20)
                              }
                              className="quantity-button"
                              aria-label={`Increase ${p.name} in bag`}
                              onClick={() => changeQty(p, 1)}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="pt-6">
                <p className="flex justify-between font-semibold">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </p>
                <p className="mt-3 rounded bg-cream p-3 text-xs leading-5 text-muted">
                  {isLive
                    ? "Prices and availability are confirmed before payment."
                    : "This is a design preview. Your bag is saved on this device; checkout and payment are not connected."}
                </p>
                {isLive && (
                  <button
                    disabled={!acceptingOrders}
                    onClick={() => setCheckingOut(true)}
                    className="mt-4 w-full rounded-lg bg-forest py-3 text-sm font-bold text-white"
                  >
                    {acceptingOrders
                      ? "Checkout securely"
                      : !online
                        ? "Reconnect to checkout"
                        : "Store currently closed"}
                  </button>
                )}
                <button
                  onClick={closeCart}
                  className="mt-4 w-full rounded-lg bg-forest py-3 text-sm font-bold text-white"
                >
                  Continue browsing
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <ShoppingBag size={40} className="mb-5 text-forest" />
              <h3 className="text-xl font-semibold">
                Room for the good stuff.
              </h3>
              <p className="mt-2 text-sm text-muted">
                Add a few everyday favourites to get started.
              </p>
              <button
                onClick={closeCart}
                className="mt-6 rounded-lg bg-forest px-6 py-3 text-sm text-white"
              >
                Browse essentials
              </button>
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => console.warn("Offline support could not be registered."));
  });
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
