import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { addToCart, removeFromCart } from "../redux/cartSlice";
import {
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import { toast } from "react-hot-toast";

// Config & Components
import { BASEURL } from "../config";
import PhoneVerificationModal from "../components/order/PhoneVerificationModal";
import axios from "axios";

const Cart = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // 1. Get Cart & User Info from Redux
  const cart = useSelector((state) => state.cart);
  const { userInfo } = useSelector((state) => state.user);
  const { cartItems } = cart;

  // 2. Local State
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  // --- 3. Calculations ---
  const itemsPrice = cartItems.reduce(
    (acc, item) => acc + (item.price ?? 0) * (item.qty ?? 0),
    0,
  );

  // 5% Tax
  const taxPrice = Number((0.05 * itemsPrice).toFixed(2));

  // Free shipping over ₹500, else ₹40
  const shippingPrice = itemsPrice > 500 ? 0 : 40;

  const totalBeforeDiscount = itemsPrice + taxPrice + shippingPrice;

  // Ensure total never goes below 0
  const totalPrice = Math.max(0, totalBeforeDiscount - discount).toFixed(2);

  // --- 4. Fetch Coupons & Load Saved Coupon ---
  useEffect(() => {
    const abort = new AbortController();

    const fetchCoupons = async () => {
      try {
        const res = await fetch(`${BASEURL}/api/v1/coupons/available`, {
          credentials: "include",
          signal: abort.signal,
        });
        if (!res.ok) {
          console.error("Error fetching coupons: non-200 response");
          return;
        }
        const data = await res.json();
        setAvailableCoupons(Array.isArray(data) ? data : []);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Error fetching coupons:", error);
        }
      }
    };

    fetchCoupons();

    // Check Local Storage for previously applied coupons
    const savedCoupon = localStorage.getItem("appliedCoupon");
    const savedDiscount = localStorage.getItem("couponDiscount");

    if (savedCoupon && savedDiscount) {
      // Validate coupon is still active before showing stale data
      const cartTotal = itemsPrice + taxPrice + shippingPrice;
      fetch(`${BASEURL}/api/v1/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: savedCoupon, orderAmount: cartTotal }),
        credentials: "include",
        signal: abort.signal,
      }).then((res) => {
        if (!res.ok) {
          localStorage.removeItem("appliedCoupon");
          localStorage.removeItem("couponDiscount");
          return;
        }
        setAppliedCoupon(savedCoupon);
        setCouponCode(savedCoupon);
        setDiscount(Number(savedDiscount));
      }).catch(() => {
        localStorage.removeItem("appliedCoupon");
        localStorage.removeItem("couponDiscount");
      });
    }

    return () => abort.abort();
  }, [itemsPrice, shippingPrice, taxPrice]);

  // --- 5. Handlers ---

  const addToCartHandler = (item, qty) => {
    if (qty > 10) return toast.error("Max limit reached (10 items)");
    if (qty < 1) return; // Prevent going below 1 via this handler
    dispatch(addToCart({ ...item, qty }));
  };

  const removeFromCartHandler = (cartUniqueId) => {
    dispatch(removeFromCart(cartUniqueId));
    toast.success("Item removed from bag");
  };

  const checkoutHandler = () => {
    if (cartItems.length === 0) return toast.error("Cart is empty");
    if (!userInfo) return navigate("/login?redirect=/shipping");
    if (!userInfo.phone || !userInfo.phoneVerified) {
      setShowPhoneModal(true);
      return;
    }
    navigate("/shipping");
  };

  const applyCouponHandler = async (codeOverride) => {
    const codeToApply = codeOverride || couponCode;

    if (!codeToApply) return toast.error("Please enter a coupon code");
    if (!userInfo) return toast.error("Please login to apply coupons");

    setLoading(true);
    try {
      const config = {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      };

      const { data, status } = await axios.post(
        `${BASEURL}/api/v1/coupons/validate`,
        { code: codeToApply, orderAmount: itemsPrice },
        config,
      );

      if (status !== 200) {
        toast.error(data?.message || "Invalid or Expired Coupon");
        removeCouponHandler();
        setLoading(false);
        return;
      }

      setAppliedCoupon(codeToApply);
      setDiscount(data.discountAmount || 0);
      localStorage.setItem("appliedCoupon", codeToApply);
      localStorage.setItem("couponDiscount", String(data.discountAmount || 0));
      toast.success(data.message || "Coupon Applied Successfully!");
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired! Please log out and log in again.");
      } else {
        toast.error(
          error.response?.data?.message || "Invalid or Expired Coupon",
        );
      }

      if (error.response?.status !== 401) {
        removeCouponHandler();
      }
    } finally {
      setLoading(false);
    }
  };

  const removeCouponHandler = () => {
    setDiscount(0);
    setAppliedCoupon("");
    setCouponCode("");
    localStorage.removeItem("couponDiscount");
    localStorage.removeItem("appliedCoupon");
    toast.success("Coupon Removed");
  };

  // --- 6. Render ---
  return (
    <>
      {cartItems.length === 0 ? (
        <div className="min-h-screen bg-background text-foreground flex flex-col justify-center items-center pt-20 font-sans">
          <div className="bg-card p-12 rounded-[2rem] border border-border shadow-md flex flex-col items-center">
            <ShoppingBag size={80} className="text-muted-foreground mb-6" />
            <h2 className="font-display text-3xl font-extrabold uppercase mb-3 text-foreground">
              Your Bag is Empty
            </h2>
            <p className="text-muted-foreground mb-8 font-medium">
              Thirsty? Add some premium drinks now!
            </p>
            <Link
              to="/"
              className="bg-accent-gradient text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-accent hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Browse Shop
            </Link>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-background text-foreground pt-24 px-4 md:px-10 pb-20 font-sans">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-10">
              <ShoppingBag className="text-accent" size={36} />
              <div>
                <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight text-foreground">
                  Your <span className="text-transparent bg-clip-text bg-accent-gradient">Bag</span>
                </h1>
                <p className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-[0.3em] mt-1">
                  Review your items before checkout
                </p>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-12">
              {/* 🛒 Left Column: Cart Items List */}
              <div className="lg:w-2/3 space-y-5">
                {cartItems.map((item) => (
                  <div
                    key={item.cartUniqueId || item._id}
                    className="flex flex-col sm:flex-row items-start sm:items-center bg-card border border-border p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-accent/30 transition-all group duration-300"
                  >
                    {/* Product Image */}
                    <img
                      src={item.image || "https://placehold.co/100"}
                      alt={item.name || "Item"}
                      onError={(e) => {
                        e.target.src = "https://placehold.co/100/F1F5F9/94A3B8";
                      }}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl mb-4 sm:mb-0 transition-transform duration-500 group-hover:scale-105 border border-border bg-muted"
                    />

                    {/* Product Details */}
                    <div className="sm:ml-6 flex-1 text-left">
                      <span className="font-display text-lg font-bold text-foreground group-hover:text-accent transition-colors">
                        {item.name || "Unknown Item"}
                      </span>
                      <p className="text-foreground font-bold text-lg mt-1">
                        ₹{item.price ?? 0}
                      </p>

                      {/* Variants & Addons Display */}
                      <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                        {/* Size/Variant */}
                        {item.selectedVariant && (
                          <span className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground uppercase font-mono font-bold tracking-widest border border-border">
                            Size: {item.selectedVariant.name}
                          </span>
                        )}

                        {/* Addons */}
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {item.selectedAddons.map((addon, idx) => (
                              <span
                                key={idx}
                                className="text-[10px] bg-accent/5 px-2 py-1 rounded text-accent uppercase font-mono font-bold border border-accent/20 tracking-widest"
                              >
                                + {addon.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls & Delete */}
                    <div className="flex items-center gap-4 mt-5 sm:mt-0 sm:ml-auto">
                      <div className="flex items-center bg-muted border border-border rounded-xl overflow-hidden shadow-sm">
                        <button
                          onClick={() => addToCartHandler(item, item.qty - 1)}
                          disabled={item.qty === 1}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="p-3 text-muted-foreground hover:text-foreground hover:bg-border disabled:opacity-30 transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="px-3 font-bold text-sm w-10 text-center text-foreground font-mono">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => addToCartHandler(item, item.qty + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="p-3 text-muted-foreground hover:text-foreground hover:bg-border transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCartHandler(item.cartUniqueId)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="p-3 bg-red-50 text-red-500 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-colors shadow-sm"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}

                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-accent mt-8 font-bold text-xs uppercase tracking-widest transition-colors group"
                >
                  <ArrowLeft
                    size={16}
                    className="group-hover:-translate-x-1 transition-transform"
                  />{" "}
                  Continue Shopping
                </Link>
              </div>

              {/* 🧾 Right Column: Bill Details */}
              <div className="lg:w-1/3">
                <div className="bg-card p-8 rounded-[2rem] border border-border sticky top-28 shadow-xl">
                  <h2 className="font-display text-2xl font-bold border-b border-border pb-4 mb-6 text-foreground">
                    Bill Details
                  </h2>

                  <div className="space-y-4 mb-8">
                    {/* Subtotal */}
                    <div className="flex justify-between text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                      <span>Subtotal</span>
                      <span className="text-foreground">₹{itemsPrice.toFixed(2)}</span>
                    </div>

                    {/* GST */}
                    <div className="flex justify-between text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                      <span>GST (5%)</span>
                      <span className="text-foreground">₹{taxPrice.toFixed(2)}</span>
                    </div>

                    {/* Delivery Fee */}
                    <div className="flex justify-between text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">
                      <span>Delivery</span>
                      <span
                        className={
                          shippingPrice === 0 ? "text-emerald-600" : "text-foreground"
                        }
                      >
                        {shippingPrice === 0 ? "FREE" : `₹${shippingPrice}`}
                      </span>
                    </div>

                    {/* Discount Display */}
                    {discount > 0 && (
                      <div className="flex justify-between text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest animate-pulse bg-emerald-50 p-2 rounded-lg border border-emerald-100 mt-2">
                        <span>Coupon ({appliedCoupon})</span>
                        <span>- ₹{discount}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="border-t border-border pt-6 mt-4 flex justify-between items-end">
                      <span className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-widest">
                        To Pay
                      </span>
                      <span className="text-4xl font-display font-bold text-foreground">
                        ₹{totalPrice}
                      </span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={checkoutHandler}
                    className="w-full bg-accent-gradient text-white py-4 rounded-xl font-bold uppercase text-sm tracking-wider shadow-md hover:shadow-accent transition-all flex items-center justify-center gap-2 group mt-8 active:scale-[0.98] hover:-translate-y-0.5"
                  >
                    Checkout Now{" "}
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPhoneModal && (
        <PhoneVerificationModal
          onClose={() => setShowPhoneModal(false)}
          onVerified={() => {
            setShowPhoneModal(false);
            navigate("/shipping");
          }}
        />
      )}
    </>
  );
};

export default Cart;
