import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, clearCart } from "../redux/cartSlice";
import { getSocket } from "../utils/socket";
import {
  Plus,
  UtensilsCrossed,
  X,
  Check,
  ChevronRight,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import { BASEURL } from "../config";
import { toast } from "react-hot-toast";

// Modular Components
import MenuHero from "../components/restaurant/MenuHero";
import MenuFilters from "../components/restaurant/MenuFilters";

const RestaurantMenu = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.user);
  const { cartItems } = useSelector((state) => state.cart);

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isVegOnly, setIsVegOnly] = useState(false);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [finalPrice, setFinalPrice] = useState(0);

  // 1. Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [restaurantRes, menuRes] = await Promise.all([
          fetch(`${BASEURL}/api/v1/restaurants/${id}`),
          fetch(`${BASEURL}/api/v1/products/restaurant/${id}`),
        ]);

        if (!restaurantRes.ok || !menuRes.ok) {
          throw new Error("Failed to load restaurant data");
        }

        const restaurantData = await restaurantRes.json();
        const menuData = await menuRes.json();

        const rest = restaurantData?.data || restaurantData || null;
        setRestaurant(rest);

        const menuItems = Array.isArray(menuData)
          ? menuData
          : menuData?.data || menuData?.products || [];
        setMenu(menuItems);
      } catch {
        toast.error("Error loading menu");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // 2. Socket Connection
  useEffect(() => {
    if (!userInfo) return;
    const socket = getSocket();
    if (!socket) return;
    const handleProductUpdate = (updated) => {
      setMenu((prev) =>
        prev.map((it) => (it._id === updated._id ? { ...it, ...updated } : it)),
      );
    };
    socket.on("productUpdated", handleProductUpdate);
    return () => {
      socket.off("productUpdated", handleProductUpdate);
    };
  }, [userInfo]);

  // 3. Categorization Logic
  const categorizedMenu = useMemo(() => {
    let filtered = menu.filter(
      (it) =>
        it.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (!isVegOnly || it.isVeg) &&
        it.countInStock > 0 &&
        it.isAvailable !== false,
    );
    const groups = {};
    filtered.forEach((it) => {
      const cat = it.category || "Main Menu";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(it);
    });
    return groups;
  }, [menu, searchTerm, isVegOnly]);

  // 4. Price Logic
  useEffect(() => {
    if (!selectedItem) return;
    let price = selectedVariant
      ? Number(selectedVariant.price)
      : Number(selectedItem.price);
    const addonsPrice = selectedAddons.reduce(
      (acc, a) => acc + Number(a.price),
      0,
    );
    setFinalPrice(price + addonsPrice);
  }, [selectedVariant, selectedAddons, selectedItem]);

  const handleAddToCartClick = (item) => {
    if (item.countInStock === 0 || item.isAvailable === false) {
      toast.error("This item is currently unavailable");
      return;
    }

    if (!restaurant?.isOpenNow) {
      toast.error(
        "Shop is currently closed. Please visit during opening hours.",
      );
      return;
    }

    if (!userInfo) {
      navigate("/login");
      return;
    }

    if (
      cartItems.length > 0 &&
      restaurant &&
      cartItems[0].restaurant?.toString() !== restaurant._id?.toString()
    ) {
      const confirmed = window.confirm(
        "Your cart has items from another shop. Adding this will clear your current cart. Continue?",
      );
      if (!confirmed) return;
      dispatch(clearCart());
    }
    if (item.variants?.length > 0 || item.addons?.length > 0) {
      setSelectedItem(item);
      setSelectedVariant(item.variants?.[0] || null);
      setSelectedAddons([]);
      setShowModal(true);
    } else {
      dispatch(addToCart({ ...item, qty: 1 }));
      toast.success(`${item.name} added!`);
    }
  };

  const confirmCustomization = () => {
    dispatch(
      addToCart({
        ...selectedItem,
        price: finalPrice,
        selectedVariant,
        selectedAddons,
        qty: 1,
      }),
    );
    setShowModal(false);
    toast.success("Customized item added! 🛒");
  };

  if (loading)
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-mono font-bold tracking-widest text-xs uppercase">
          Loading Menu...
        </p>
      </div>
    );

  return (
    <div className="bg-background min-h-screen text-foreground pb-20 pt-16 font-sans">
      <MenuHero restaurant={restaurant} />
      <MenuFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isVegOnly={isVegOnly}
        setIsVegOnly={setIsVegOnly}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {Object.keys(categorizedMenu).length === 0 ? (
          <div className="text-center py-24 bg-card rounded-2xl border border-border shadow-md">
            <UtensilsCrossed size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg font-mono font-bold uppercase tracking-widest">
              No items match your craving
            </p>
          </div>
        ) : (
          Object.entries(categorizedMenu).map(([category, items]) => (
            <section key={category} className="mb-16">
              <h2 className="font-display text-3xl font-bold text-foreground mb-8 border-l-4 border-accent pl-4 flex items-center gap-3">
                {category}{" "}
                <span className="text-xs text-muted-foreground font-mono font-bold bg-muted px-3 py-1 rounded-lg border border-border tracking-normal">
                  {items.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className="bg-card border border-border rounded-2xl overflow-hidden group flex flex-col shadow-md hover:shadow-card-hover hover:-translate-y-1 hover:border-accent/30 transition-all duration-300"
                  >
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      <img
                        src={item.image || "https://placehold.co/600x400"}
                        onError={(e) => { e.target.src = "https://placehold.co/600x400/F1F5F9/94A3B8?text=No+Image"; }}
                        className={`w-full h-full object-cover transition-transform duration-700 ${
                          item.countInStock === 0
                            ? "grayscale opacity-50"
                            : "group-hover:scale-110"
                        }`}
                        alt={item.name || "Item"}
                      />
                      {item.countInStock === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
                          <span className="text-white font-mono font-bold border-2 border-white/50 bg-red-500 px-4 py-2 rotate-[-12deg] text-lg tracking-widest uppercase shadow-xl">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-6 flex flex-col flex-1 bg-card">
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <h3 className="font-display text-xl font-bold text-foreground group-hover:text-accent transition-colors leading-tight line-clamp-2">
                          {item.name || "Item"}
                        </h3>
                        <span className="text-xl font-bold text-foreground shrink-0">
                          ₹{item.price}
                        </span>
                      </div>
                      
                      <p className="text-muted-foreground text-sm font-medium mb-6 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                      
                      <button
                        onClick={() => handleAddToCartClick(item)}
                        disabled={
                          item.countInStock === 0 || !restaurant?.isOpenNow
                        }
                        className={`mt-auto w-full font-bold py-3.5 rounded-xl transition-all uppercase text-xs tracking-wider flex items-center justify-center gap-2 ${
                          item.countInStock === 0
                            ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                            : !restaurant?.isOpenNow
                            ? "bg-muted text-muted-foreground cursor-not-allowed opacity-80 border border-border"
                            : "bg-accent-gradient text-white shadow-md hover:shadow-accent active:scale-[0.98] hover:-translate-y-0.5"
                        }`}
                      >
                        {item.countInStock === 0 ? (
                          "Unavailable"
                        ) : !restaurant?.isOpenNow ? (
                          "Currently Closed"
                        ) : item.variants?.length > 0 ? (
                          <>
                            Customize <ChevronRight size={16} />
                          </>
                        ) : (
                          <>
                            Add to Cart <ShoppingBag size={16} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Customization Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl relative flex flex-col max-h-[90vh]">
            <div className="p-8 pb-4 border-b border-border flex justify-between items-start">
              <div>
                <h3 className="font-display text-2xl font-bold text-foreground leading-none mb-2">
                  {selectedItem.name}
                </h3>
                <p className="text-accent font-mono font-bold text-xs uppercase tracking-widest">
                  Customize your order
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="bg-muted text-muted-foreground hover:text-foreground hover:bg-border p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto no-scrollbar space-y-8 flex-1">
              {/* Variants */}
              {selectedItem.variants?.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                    Select Size
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedItem.variants.map((v) => (
                      <label
                        key={v.name}
                        className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                          selectedVariant === v
                            ? "bg-accent/5 border-accent shadow-sm"
                            : "bg-card border-border hover:border-accent/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              selectedVariant === v
                                ? "border-accent"
                                : "border-muted-foreground"
                            }`}
                          >
                            {selectedVariant === v && (
                              <div className="w-2.5 h-2.5 rounded-full bg-accent"></div>
                            )}
                          </div>
                          <span className="font-bold text-foreground text-sm">
                            {v.name}
                          </span>
                        </div>
                        <span className="font-bold text-foreground">
                          ₹{v.price}
                        </span>
                        <input
                          type="radio"
                          className="hidden"
                          checked={selectedVariant === v}
                          onChange={() => setSelectedVariant(v)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Addons */}
              {selectedItem.addons?.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent"></span>
                    Add Extras
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {selectedItem.addons.map((a) => {
                      const isSel = selectedAddons.some(
                        (sa) => sa._id === a._id,
                      );
                      return (
                        <label
                          key={a._id}
                          className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            isSel
                              ? "bg-accent/5 border-accent shadow-sm"
                              : "bg-card border-border hover:border-accent/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                isSel
                                  ? "bg-accent border-accent"
                                  : "border-muted-foreground bg-transparent"
                              }`}
                            >
                              {isSel && (
                                <Check size={14} className="text-white" />
                              )}
                            </div>
                            <span className="font-bold text-foreground text-sm">
                              {a.name}
                            </span>
                          </div>
                          <span className="font-bold text-foreground">
                            +₹{a.price}
                          </span>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={isSel}
                            onChange={() =>
                              setSelectedAddons((prev) =>
                                isSel
                                  ? prev.filter((sa) => sa._id !== a._id)
                                  : [...prev, a],
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-8 bg-muted border-t border-border rounded-b-2xl">
              <button
                onClick={confirmCustomization}
                className="w-full bg-accent-gradient text-white py-4 rounded-xl font-bold uppercase flex justify-between items-center px-8 transition-all active:scale-[0.98] shadow-md hover:shadow-accent text-sm tracking-wider hover:-translate-y-0.5"
              >
                <span>Add to Cart</span>
                <span className="bg-black/20 px-3 py-1 rounded-lg border border-white/20">
                  ₹{finalPrice}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantMenu;
