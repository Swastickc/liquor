import React, { useEffect, useState } from "react";
import Auth, { useSession } from "./Auth";
import { backend, callApi, isLive } from "./backend";

export function DriverControls({ order, onUpdate }) {
  const [drivers, setDrivers] = useState([]),
    [selected, setSelected] = useState(order.driver_id || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    backend
      .from("grocery_drivers")
      .select("*")
      .eq("active", true)
      .then(({ data, error }) => {
        if (error) setError("Drivers could not be loaded.");
        else setDrivers(data || []);
      });
  }, []);
  async function assign() {
    setBusy(true);
    setError("");
    try {
      await callApi("assign-driver", { orderId: order.id, driverId: selected });
      await onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold">
        Assign delivery partner
        <select
          className="mt-2 block w-full rounded border p-3 text-sm"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose an active driver</option>
          {drivers.map((d) => (
            <option key={d.user_id} value={d.user_id}>
              {d.name} · {d.phone}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={!selected || busy}
        onClick={assign}
        className="rounded-lg bg-forest px-4 py-3 text-xs text-white"
      >
        {busy
          ? "Assigning…"
          : order.driver_id
            ? "Reassign & reset delivery code"
            : "Dispatch order"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
export function DriverManager() {
  const [drivers, setDrivers] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function refresh() {
    const { data, error } = await backend
      .from("grocery_drivers")
      .select("*")
      .order("name");
    if (error) setError("Driver profiles could not be loaded.");
    else setDrivers(data || []);
  }
  useEffect(() => {
    refresh();
  }, []);
  async function toggle(d) {
    setBusy(d.user_id);
    setError("");
    try {
      await callApi("approve-driver", {
        driverId: d.user_id,
        active: !d.active,
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="mt-8 rounded-xl border bg-white p-5">
      <div className="flex justify-between gap-4">
        <h2 className="text-xl font-semibold">Delivery partners</h2>
        <button className="text-sm underline" onClick={refresh}>
          Refresh drivers
        </button>
      </div>
      <p className="my-3 text-sm text-muted">
        Drivers sign in at{" "}
        <a href="#driver" className="underline">
          Delivery partner
        </a>{" "}
        and request access. Approve only your staff. Pausing a driver stops
        their access; reassign outstanding deliveries.
      </p>
      {!drivers.length && <p className="text-sm">No requests yet.</p>}
      {drivers.map((d) => (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t py-4"
          key={d.user_id}
        >
          <div>
            <p className="font-semibold">{d.name}</p>
            <p className="text-sm text-muted">
              {d.phone} · {d.active ? "Active" : "Awaiting approval / paused"}
            </p>
          </div>
          <button
            disabled={busy === d.user_id}
            onClick={() => toggle(d)}
            className="rounded border px-4 py-2 text-sm"
          >
            {busy === d.user_id
              ? "Saving…"
              : d.active
                ? "Pause driver"
                : "Approve driver"}
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
function DeliveryCard({ order, onUpdate }) {
  const [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function complete(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await callApi("complete-delivery", { orderId: order.id, code });
      await onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-xl border bg-white p-5">
      <p className="text-xs text-muted">
        #{order.id.slice(0, 8)} · {order.status.replaceAll("_", " ")}
      </p>
      <h2 className="mt-3 font-semibold">{order.address.name}</h2>
      <p className="my-2 text-sm">
        {order.address.line}, {order.address.pincode}
      </p>
      <a className="text-sm underline" href={`tel:${order.address.phone}`}>
        Call customer
      </a>
      <ul className="my-4 text-sm">
        {order.items.map((i) => (
          <li key={i.id}>
            {i.quantity} × {i.name} · {i.size}
          </li>
        ))}
      </ul>
      {order.status === "out_for_delivery" && (
        <form onSubmit={complete}>
          <label className="block text-sm">
            Customer delivery code
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-2 block w-full rounded border p-3"
            />
          </label>
          <p className="my-3 text-xs text-muted">
            Ask for the code only after handing over the groceries. The customer
            can find it in Your orders.
          </p>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-forest p-3 text-sm text-white"
          >
            {busy ? "Confirming…" : "Confirm delivery"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </article>
  );
}
export default function Delivery() {
  const { session, loading } = useSession();
  const [profile, setProfile] = useState(null),
    [orders, setOrders] = useState([]),
    [checking, setChecking] = useState(true),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    if (!session) return;
    try {
      const { data, error } = await backend
        .from("grocery_drivers")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      setProfile(data);
      if (data?.active) {
        const result = await backend
          .from("grocery_orders")
          .select("*")
          .eq("driver_id", session.user.id)
          .in("status", ["out_for_delivery", "delivered"])
          .order("created_at", { ascending: false })
          .limit(50);
        if (result.error) throw result.error;
        setOrders(result.data);
      } else setOrders([]);
    } catch {
      setError("Deliveries could not be loaded. Please retry.");
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    refresh();
    if (!session) return;
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [session]);
  async function enrol(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await callApi("driver-enrol", { name, phone });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!isLive)
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-2xl font-semibold">Delivery partner</h1>
        <p className="my-4">
          Driver accounts become available when the store backend is connected.
        </p>
        <a href="#" className="underline">
          Back to store
        </a>
      </main>
    );
  if (loading) return <p className="p-8">Checking your account…</p>;
  if (!session)
    return (
      <div className="p-5">
        <Auth
          title="Delivery partner sign-in"
          onBack={() => (window.location.hash = "")}
        />
      </div>
    );
  return (
    <main className="mx-auto max-w-2xl p-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <a href="#" className="text-xs underline">
            Back to store
          </a>
          <h1 className="mt-3 text-2xl font-semibold">Your deliveries</h1>
        </div>
        <button
          className="text-sm underline"
          onClick={() => backend.auth.signOut()}
        >
          Sign out
        </button>
      </header>
      {error && (
        <p role="alert" className="my-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {checking ? (
        <p>Loading…</p>
      ) : !profile ? (
        <form onSubmit={enrol} className="space-y-4 rounded-xl border p-5">
          <h2 className="font-semibold">Request driver access</h2>
          <label className="block text-sm">
            Full name
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 block w-full rounded border p-3"
            />
          </label>
          <label className="block text-sm">
            Phone
            <input
              required
              type="tel"
              pattern="[0-9]{10}"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-2 block w-full rounded border p-3"
            />
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-forest p-3 text-sm text-white"
          >
            {busy ? "Sending…" : "Request access"}
          </button>
        </form>
      ) : !profile.active ? (
        <p className="rounded border p-5">
          Your profile is awaiting store approval or has been paused. Contact
          your store administrator.
        </p>
      ) : (
        <>
          <button
            className="mb-4 rounded border px-4 py-2 text-sm"
            onClick={refresh}
          >
            Refresh deliveries
          </button>
          <div className="space-y-4">
            {!orders.length ? (
              <p>No deliveries assigned yet.</p>
            ) : (
              orders.map((o) => (
                <DeliveryCard key={o.id} order={o} onUpdate={refresh} />
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}
