import React, { useEffect, useState } from "react";
import { getSettings, saveSettings } from "./settings";
export default function StoreSettings() {
  const [settings, setSettings] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() =>
        setError("Store settings could not be loaded. Reload to retry."),
      );
  }, []);
  async function save(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    const codes = settings.delivery_pincodes
      .map((p) => p.trim())
      .filter(Boolean);
    if (!codes.length || codes.some((p) => !/^\d{6}$/.test(p))) {
      setError("Add at least one valid 6-digit delivery pincode.");
      return;
    }
    if (
      settings.support_phone &&
      !/^\+?[0-9]{10,13}$/.test(settings.support_phone)
    ) {
      setError("Enter a valid support phone number.");
      return;
    }
    setBusy(true);
    try {
      await saveSettings({
        ...settings,
        delivery_pincodes: [...new Set(codes)],
        delivery_fee: Number(settings.delivery_fee),
        minimum_order: Number(settings.minimum_order),
      });
      setNotice("Store settings saved.");
    } catch {
      setError(
        "Settings could not be saved. Check your connection and admin access.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!settings)
    return (
      <p role="status" className="my-5 text-sm">
        {error || "Loading store controls…"}
      </p>
    );
  return (
    <section className="my-7 rounded-xl border bg-white p-5">
      <form onSubmit={save}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Store controls</h2>
            <p className="mt-1 text-xs text-muted">
              Store hours use India Standard Time. Closing blocks new orders.
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              aria-label="Accept new orders"
              type="checkbox"
              checked={settings.is_open}
              onChange={(e) =>
                setSettings({ ...settings, is_open: e.target.checked })
              }
              className="h-5 w-5"
            />
            {settings.is_open
              ? "Accept orders during store hours"
              : "Store closed"}
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["opens_at", "Opening time", "time"],
            ["closes_at", "Closing time", "time"],
            ["delivery_fee", "Delivery fee (₹)", "number"],
            ["minimum_order", "Minimum order (₹)", "number"],
            ["support_phone", "Support phone (optional)", "tel"],
          ].map(([name, label, type]) => (
            <label key={name} className="text-xs font-semibold">
              {label}
              <input
                required={name !== "support_phone"}
                type={type}
                min={type === "number" ? 0 : undefined}
                max={type === "number" ? 100000 : undefined}
                step={type === "number" ? ".01" : undefined}
                value={settings[name]}
                onChange={(e) =>
                  setSettings({ ...settings, [name]: e.target.value })
                }
                className="mt-1.5 w-full rounded border p-2.5 text-sm font-normal"
              />
            </label>
          ))}
          <label className="text-xs font-semibold">
            Delivery pincodes
            <input
              required
              value={settings.delivery_pincodes.join(",")}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  delivery_pincodes: e.target.value.split(","),
                })
              }
              placeholder="713409,713405"
              className="mt-1.5 w-full rounded border p-2.5 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold sm:col-span-2 lg:col-span-3">
            Closed-store message
            <input
              required
              maxLength={200}
              value={settings.closed_message}
              onChange={(e) =>
                setSettings({ ...settings, closed_message: e.target.value })
              }
              className="mt-1.5 w-full rounded border p-2.5 text-sm font-normal"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-forest">
            {notice}
          </p>
          <button
            disabled={busy}
            className="rounded-md bg-forest px-5 py-3 text-xs font-semibold text-white"
          >
            {busy ? "Saving…" : "Save store settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
