import React, { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { categories, money } from "./data";
import AnimatedContent from "./components/reactbits/AnimatedContent";
import SpotlightCard from "./components/reactbits/SpotlightCard";

export default function Storefront({
  storeSettings,
  acceptingOrders,
  products,
  visible,
  category,
  setCategory,
  query,
  setQuery,
  sort,
  setSort,
  cart,
  totalCount,
  subtotal,
  changeQty,
  browse,
  isLive,
  catalogLoading,
  catalogError,
  refreshCatalog,
  openCart,
  cartButtonRef,
  ProductArt,
}) {
  const [detail, setDetail] = useState(null);
  return (
    <>
      <div className="store-notice">
        Your neighbourhood. Your daily essentials.{" "}
        <span>
          Kalna, West Bengal <ArrowUpRight size={12} />
        </span>
      </div>
      <header className="store-header">
        <a href="/" className="store-brand" aria-label="Kalna Daily home">
          kalna<span>daily</span>
        </a>
        <nav aria-label="Store navigation" className="header-links">
          <button onClick={() => browse()}>The store</button>
          <button onClick={() => browse("Premium Beverages")}>Drinks</button>
          <button onClick={() => browse("Snacks")}>Fresh picks</button>
        </nav>
        <div className="header-actions">
          {isLive && <a href="#account">Account</a>}
          <button ref={cartButtonRef} className="bag-button" onClick={openCart}>
            <ShoppingBag size={17} />
            <span>My bag</span>
            <span className="bag-count">{totalCount}</span>
          </button>
        </div>
      </header>
      <div className="store-toolbar">
        <div className="delivery-location">
          <MapPin size={17} />
          <div>
            <span>YOUR LOCAL STORE</span>
            <p>Kalna, West Bengal</p>
          </div>
        </div>
        <label className="store-search">
          <Search size={18} />
          <input
            type="search"
            aria-label="Search groceries"
            placeholder="Search drinks, snacks and daily essentials"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={15} />
            </button>
          )}
        </label>
        <p className="preview-label">
          {isLive ? "Everyday essentials" : "Design preview"}
          <span>
            {isLive ? "Drinks, pantry & home" : "Sample catalog & prices"}
          </span>
        </p>
      </div>
      <main className="store-main">
        {storeSettings && !acceptingOrders && (
          <div className="store-closed" role="status">
            <strong>Currently closed for orders.</strong>{" "}
            {storeSettings.closed_message}{" "}
            <span>
              Hours: {storeSettings.opens_at.slice(0, 5)}–
              {storeSettings.closes_at.slice(0, 5)} IST
            </span>
          </div>
        )}

        <AnimatedContent distance={16} duration={0.45} className="store-hero">
          <div className="hero-copy">
            <span className="eyebrow">THE DAILY STORE — KALNA</span>
            <h1>
              A fresh take
              <br />
              on your everyday.
            </h1>
            <p>
              Good drinks. Better snacks.
              <br />
              The essentials you always come back for.
            </p>
            <button className="primary-action" onClick={() => browse()}>
              Shop the essentials <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="hero-still">
            <div className="hero-product-one">
              <img src="/products/orange.webp" alt="Orange juice" />
            </div>
            <div className="hero-product-two">
              <img src="/products/chips.webp" alt="Fresh red apple" />
            </div>
            <div className="hero-product-three">
              <img src="/products/nuts.webp" alt="Fresh strawberries" />
            </div>
            <span className="hero-caption">
              THE FRESH EDIT <span>KALNA DAILY</span>
            </span>
          </div>
        </AnimatedContent>
        <section id="essentials" className="store-catalog">
          <div className="catalog-heading">
            <div>
              <span className="eyebrow">FILL YOUR BAG</span>
              <h2>
                The everyday collection
                <span>
                  {" "}
                  ({products.filter((p) => p.active !== false).length})
                </span>
              </h2>
            </div>
            <p>Something good for every day.</p>
          </div>
          <div className="catalog-controls">
            <nav aria-label="Product categories" className="filter-pills">
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </nav>
            <label className="catalog-sort">
              <SlidersHorizontal size={14} />
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="featured">Featured</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
              </select>
            </label>
          </div>
          {(query || category !== "All essentials") && (
            <p className="result-label">
              {visible.length} {visible.length === 1 ? "product" : "products"}
              {query ? ` matching “${query}”` : ` in ${category}`}{" "}
              <button
                onClick={() => {
                  setQuery("");
                  setCategory(categories[0]);
                }}
              >
                Clear filters <X size={12} />
              </button>
            </p>
          )}
          {catalogLoading ? (
            <p role="status" className="store-empty">
              Loading essentials…
            </p>
          ) : catalogError ? (
            <div role="alert" className="store-empty">
              <p>{catalogError}</p>
              <button onClick={refreshCatalog} className="primary-action">
                Retry catalog
              </button>
            </div>
          ) : visible.length ? (
            <div className="store-product-grid">
              {visible.map((p) => (
                <article key={p.id} className="store-product">
                  <SpotlightCard
                    className="product-spotlight"
                    spotlightColor="rgba(232,222,204,0.18)"
                  >
                    <button
                      className="product-view"
                      aria-label={`View ${p.name}`}
                      onClick={() => setDetail(p)}
                    >
                      <ProductArt product={p} />
                    </button>
                    {p.oldPrice && (
                      <span className="product-saving">
                        {Math.round((1 - p.price / p.oldPrice) * 100)}% less
                      </span>
                    )}
                    <button
                      className="product-quick"
                      aria-label={`View details for ${p.name}`}
                      onClick={() => setDetail(p)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </SpotlightCard>
                  <div className="product-meta">
                    <p className="product-brand">{p.brand}</p>
                    <button
                      className="product-title"
                      onClick={() => setDetail(p)}
                    >
                      {p.name}
                    </button>
                    <p className="product-size">{p.size}</p>
                    <div className="product-purchase">
                      <p>
                        <strong>{money(p.price)}</strong>
                        {p.oldPrice && <del>{money(p.oldPrice)}</del>}
                      </p>
                      {cart[p.id] ? (
                        <div className="product-stepper">
                          <button
                            aria-label={`Remove one ${p.name}`}
                            onClick={() => changeQty(p, -1)}
                          >
                            <Minus size={13} />
                          </button>
                          <span>{cart[p.id]}</span>
                          <button
                            aria-label={`Add one ${p.name}`}
                            disabled={cart[p.id] >= Math.min(p.stock ?? 20, 20)}
                            onClick={() => changeQty(p, 1)}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="product-add"
                          disabled={p.stock === 0}
                          onClick={() => changeQty(p, 1)}
                          aria-label={`Add ${p.name} to cart`}
                        >
                          {p.stock === 0 ? "Sold out" : "Add to bag"}
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="store-empty">
              <Search size={28} />
              <h3>No essentials found</h3>
              <p>Try another search or explore the full collection.</p>
              <button
                className="primary-action"
                onClick={() => {
                  setQuery("");
                  setCategory(categories[0]);
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
        <AnimatedContent
          distance={12}
          duration={0.4}
          className="collection-banner"
        >
          <div>
            <span className="eyebrow">
              FROM YOUR FIRST CUP TO YOUR LAST SIP
            </span>
            <h2>
              Make room for
              <br />
              your favourites.
            </h2>
            <button onClick={() => browse("Premium Beverages")}>
              Explore the drinks collection <ArrowRight size={16} />
            </button>
          </div>
          <img src="/products/coffee.webp" alt="Jar of instant coffee" />
          <span className="collection-number">02</span>
        </AnimatedContent>
      </main>
      <footer className="store-footer">
        <div>
          <a href="/" className="store-brand">
            kalna<span>daily</span>
          </a>
          <p>The everyday store, close to home.</p>
        </div>
        <div className="footer-links">
          <button onClick={() => browse()}>Shop essentials</button>
          <a href="#studio">Open store studio</a>
          <a href="#driver">Delivery partner</a>
          {isLive && <a href="#account">Your orders</a>}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Kalna Daily</span>
          <p>
            {isLive
              ? "Groceries & non-alcoholic beverages."
              : "Interactive preview · Sample products and prices · No real orders"}
          </p>
        </div>
      </footer>
      {totalCount > 0 && (
        <button className="mobile-bag" onClick={openCart}>
          <ShoppingBag size={17} />
          <span>
            {totalCount} items · {money(subtotal)}
          </span>{" "}
          View bag <ArrowRight size={16} />
        </button>
      )}
      {detail && (
        <ProductDetail
          product={detail}
          onClose={() => setDetail(null)}
          onAdd={() => changeQty(detail, 1)}
          quantity={cart[detail.id] || 0}
          ProductArt={ProductArt}
        />
      )}
    </>
  );
}
function ProductDetail({ product: p, onClose, onAdd, quantity, ProductArt }) {
  const ref = React.useRef(null),
    previous = React.useRef(null);
  React.useEffect(() => {
    previous.current = document.activeElement;
    ref.current.showModal();
    return () => previous.current?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="product-dialog"
      onCancel={onClose}
      aria-labelledby="product-detail-title"
    >
      <button
        className="detail-close"
        onClick={onClose}
        aria-label="Close product details"
      >
        <X size={20} />
      </button>
      <div className="detail-layout">
        <div className="detail-image">
          <ProductArt product={p} />
        </div>
        <div className="detail-info">
          <span className="eyebrow">{p.category}</span>
          <h2 id="product-detail-title">{p.name}</h2>
          <p>{p.brand}</p>
          <dl>
            <div>
              <dt>Pack size</dt>
              <dd>{p.size}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{p.stock === 0 ? "Sold out" : "In stock"}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>{money(p.price)}</dd>
            </div>
          </dl>
          <button
            className="primary-action"
            onClick={onAdd}
            disabled={quantity >= Math.min(p.stock ?? 20, 20)}
          >
            {p.stock === 0
              ? "Sold out"
              : quantity
                ? "Add another"
                : "Add to bag"}{" "}
            <Plus size={16} />
          </button>
          <p role="status" className="detail-quantity">
            {quantity ? `${quantity} in your bag` : ""}
          </p>
        </div>
      </div>
    </dialog>
  );
}
