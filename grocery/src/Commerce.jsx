import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Package, RefreshCw } from "lucide-react";
import Auth, { useSession } from "./Auth";
import { backend, callApi, ensureCheckoutSession } from "./backend";
import { money } from "./data";
import { cartTotals } from "./catalog";
import { DriverControls } from "./Delivery";
import { WorkspaceHeader } from "./Workspace";
let checkoutScript;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript)
    checkoutScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        checkoutScript = null;
        reject(
          new Error(
            "Payment checkout could not load. Please check your connection.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return checkoutScript;
}
export function OrderList({ admin = false }) {
  const [codes, setCodes] = useState({});
  const [orders, setOrders] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function refresh() {
    setLoading(true);
    setError("");
    const { data, error } = await backend
      .from("grocery_orders")
      .select("*")
      .eq("view", admin ? "admin" : "customer")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setError("Orders could not be loaded. Please retry.");
    else setOrders(data);
    if (!admin) {
      const result = await backend
        .from("grocery_delivery_codes")
        .select("order_id,code");
      if (!result.error)
        setCodes(
          Object.fromEntries(
            (result.data || []).map((c) => [c.order_id, c.code]),
          ),
        );
    }
    setLoading(false);
  }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  async function advance(order) {
    setBusy(order.id);
    setError("");
    try {
      await callApi("update-order", {
        orderId: order.id,
        previousStatus: order.status,
        status: {
          paid: "packing",
          packing: "out_for_delivery",
          out_for_delivery: "delivered",
        }[order.status],
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {admin ? "Recent orders" : "Your orders"}
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 rounded border px-3 py-2 text-xs"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="my-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="py-8 text-sm text-muted">
          Loading orders…
        </p>
      ) : !orders.length ? (
        <p className="rounded-lg bg-cream p-7 text-sm text-muted">
          No orders yet.
        </p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">
                    #{order.id.slice(0, 8)} ·{" "}
                    {new Date(order.created_at).toLocaleDateString("en-IN")}
                  </p>
                  <p className="mt-2 font-semibold">
                    {money(order.amount / 100)}
                  </p>
                </div>
                <span className="rounded-full bg-[#edf4e8] px-3 py-1 text-xs text-forest">
                  {order.status.replaceAll("_", " ")}
                </span>
              </div>
              {["paid", "packing", "out_for_delivery", "delivered"].includes(
                order.status,
              ) && (
                <ol className="order-progress" aria-label="Delivery progress">
                  {["paid", "packing", "out_for_delivery", "delivered"].map(
                    (step, index) => (
                      <li
                        key={step}
                        data-complete={
                          index <=
                          [
                            "paid",
                            "packing",
                            "out_for_delivery",
                            "delivered",
                          ].indexOf(order.status)
                        }
                      >
                        <span>{index + 1}</span>
                        {
                          ["Confirmed", "Packing", "On the way", "Delivered"][
                            index
                          ]
                        }
                      </li>
                    ),
                  )}
                </ol>
              )}
              <ul className="my-4 space-y-1 text-sm text-muted">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.name}
                  </li>
                ))}
              </ul>
              {order.status === "pending" && (
                <p className="text-xs text-muted">
                  Payment pending. Stock is reserved for up to 15 minutes. If
                  you were debited, refresh shortly; payment confirmation may
                  still be arriving.
                </p>
              )}
              {order.status === "payment_review" && (
                <p className="text-sm text-amber-800">
                  Payment received after the reservation changed. The store must
                  review fulfillment or issue a refund.
                </p>
              )}
              {!admin &&
                order.status === "out_for_delivery" &&
                codes[order.id] && (
                  <p className="my-3 rounded bg-cream p-3 text-sm">
                    Delivery code:{" "}
                    <strong className="tracking-widest">
                      {codes[order.id]}
                    </strong>
                    <br />
                    <span className="text-xs text-muted">
                      Share this with the driver only after receiving your
                      groceries.
                    </span>
                  </p>
                )}
              {admin && (
                <>
                  <p className="text-xs leading-5 text-muted">
                    {order.address.name} · {order.address.phone}
                    <br />
                    {order.address.line}, {order.address.pincode}
                  </p>
                  {["packing", "out_for_delivery"].includes(order.status) && (
                    <DriverControls order={order} onUpdate={refresh} />
                  )}
                  {order.status === "paid" && (
                    <button
                      disabled={busy === order.id}
                      onClick={() => advance(order)}
                      className="mt-4 rounded-lg bg-forest px-4 py-2 text-xs text-white"
                    >
                      {busy === order.id
                        ? "Updating…"
                        : {
                            paid: "Start packing",
                            packing: "Mark out for delivery",
                            out_for_delivery: "Mark delivered",
                          }[order.status]}
                    </button>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
export function Account({ onBack }) {
  const { session, loading } = useSession();
  if (loading) return <p className="p-10 text-center">Loading account…</p>;
  if (!session || session.user.guest)
    return <Auth title="Sign in to your account" onBack={onBack} />;
  return (
    <div className="account-page">
      <WorkspaceHeader label="Your account" onBack={onBack} />
      <div className="mx-auto max-w-3xl p-6">
        <button
          onClick={onBack}
          className="mb-7 flex items-center gap-2 text-sm"
        >
          <ArrowLeft size={16} /> Back to store
        </button>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Your account</h1>
            <p className="mt-2 text-sm text-muted">
              {session.user.email}
            </p>
          </div>
          <button
            onClick={() => backend.auth.signOut()}
            className="text-sm underline"
          >
            Sign out
          </button>
        </div>
        <OrderList />
      </div>
    </div>
  );
}
export function Checkout({ cart, products, settings, onSuccess, onBack }) {
  const { session, loading } = useSession();
  const [address, setAddress] = useState({
    name: "",
    phone: "",
    line: "",
    pincode: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null);
  const request = useRef({ fingerprint: "", key: "" });
  const { subtotal } = cartTotals(products, cart);
  const deliveryFee = Number(settings?.delivery_fee || 0);
  const minimum = Number(settings?.minimum_order || 0);
  async function pay(e) {
    e.preventDefault();
    if (busy) return;
    if (!navigator.onLine) {
      setError("Reconnect to the internet before checking out.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const checkoutSession = await ensureCheckoutSession();
      const items = products
        .filter((p) => cart[p.id] > 0 && p.active !== false)
        .map((p) => ({ id: p.id, quantity: cart[p.id] }));
      const fingerprint = JSON.stringify({
        user: checkoutSession.user.id,
        items,
        address,
      });
      if (request.current.fingerprint !== fingerprint)
        request.current = { fingerprint, key: crypto.randomUUID() };
      await loadRazorpay();
      const data = await callApi("create-order", {
        items,
        address,
        requestKey: request.current.key,
      });
      const payment = new window.Razorpay({
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.paymentOrderId,
        name: "Kalna Daily",
        description: "Grocery order",
        prefill: {
          name: address.name,
          ...(checkoutSession.user.email
            ? { email: checkoutSession.user.email }
            : {}),
          contact: address.phone,
        },
        theme: { color: "#174c37" },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setError(
              "Checkout closed. No confirmed order yet. If you were debited, check your account before trying again.",
            );
          },
        },
        handler: async (response) => {
          try {
            const verified = await callApi("verify-payment", {
              orderId: data.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            setResult(verified);
            onSuccess();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        },
      });
      payment.on("payment.failed", () => {
        setBusy(false);
        setError(
          "Payment was not completed. Check your account if a debit appears.",
        );
      });
      payment.open();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  if (loading) return <p className="py-10">Checking your account…</p>;

  if (!session || session.user.guest)
    return <Auth title="Sign in to place your order" onBack={onBack} />;

  if (result)
    return (
      <div className="rounded-xl bg-cream p-7">
        <Check size={32} className="mb-4 text-forest" />
        <h2 className="text-2xl font-semibold">
          {result.status === "payment_review"
            ? "Payment needs review"
            : "Your order is confirmed"}
        </h2>
        <p className="mt-3 text-sm">Order #{result.orderId.slice(0, 8)}</p>
        <p className="mt-3 text-sm text-muted">
          {result.status === "payment_review"
            ? "The store will review fulfillment or refund your payment."
            : "Follow its progress in your account."}
        </p>
        <button
          onClick={onBack}
          className="mt-5 rounded bg-forest px-5 py-3 text-sm text-white"
        >
          Back to store
        </button>
      </div>
    );
  return (
    <form onSubmit={pay} className="mx-auto max-w-lg">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-2 text-xs"
      >
        <ArrowLeft size={14} /> Back to bag
      </button>
      <h2 className="text-2xl font-semibold">Where should it go?</h2>
      <p className="mb-5 mt-2 text-xs text-muted">
        Add your phone number and delivery address, then pay securely.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["name", "Full name", "text"],
          ["phone", "Phone number", "tel"],
          ["line", "House, street & locality", "text"],
          ["pincode", "Pincode", "text"],
        ].map(([name, label, type]) => (
          <label
            key={name}
            className={`text-xs font-semibold ${name === "line" ? "sm:col-span-2" : ""}`}
          >
            {label}
            <input
              required
              disabled={busy}
              type={type}
              autoComplete={
                {
                  name: "name",
                  phone: "tel-national",
                  line: "street-address",
                  pincode: "postal-code",
                }[name]
              }
              minLength={name === "line" ? 8 : name === "name" ? 2 : undefined}
              maxLength={{ name: 100, phone: 10, line: 300, pincode: 6 }[name]}
              pattern={
                name === "phone"
                  ? "[0-9]{10}"
                  : name === "pincode"
                    ? "[0-9]{6}"
                    : undefined
              }
              value={address[name]}
              onChange={(e) =>
                setAddress({ ...address, [name]: e.target.value })
              }
              className="mt-1.5 w-full rounded border px-3 py-3 text-sm font-normal"
            />
          </label>
        ))}
      </div>
      <p className="mt-5 text-xs leading-5 text-muted">
        Payment opens securely in Razorpay. Stock, prices and delivery charges
        are confirmed by the store before payment.
      </p>
      <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
        <div className="flex justify-between">
          <dt>Items</dt>
          <dd>{money(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{deliveryFee ? money(deliveryFee) : "Free"}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Estimated total</dt>
          <dd>{money(subtotal + deliveryFee)}</dd>
        </div>
      </dl>
      {subtotal < minimum && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          Add {money(minimum - subtotal)} more to reach the minimum order.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy || subtotal < minimum || !subtotal}
        className="mt-5 w-full rounded-lg bg-forest py-3 text-sm font-semibold text-white"
      >
        {busy ? "Opening secure payment…" : "Continue to payment"}
      </button>
    </form>
  );
}
