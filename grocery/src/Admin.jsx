import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { categories, money } from "./data";
import { validateProduct } from "./catalog";
import { backend, isLive, uploadPhoto } from "./backend";
import StoreSettings from "./StoreSettings";
import { OrderList } from "./Commerce";
import { DriverManager } from "./Delivery";
import { WorkspaceHeader, EmptyWorkspace, workspaceTabs } from "./Workspace";
const blank = {
  name: "",
  brand: "",
  category: "Snacks",
  size: "",
  price: "",
  oldPrice: "",
  color: "#b0b184",
  label: "",
  type: "bag",
  image: "",
  active: true,
  stock: 0,
};
export default function Admin({ products, onSave, onBack, ProductArt }) {
  const [tab, setTab] = useState("catalog");
  const [query, setQuery] = useState(""),
    [draft, setDraft] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [saving, setSaving] = useState(false);
  const formRef = useRef(null),
    opener = useRef(null);
  function edit(p, event) {
    opener.current = event.currentTarget;
    setDraft({ stock: 0, ...p, _originalStock: p.id ? p.stock : undefined });
    setError("");
    formRef.current.showModal();
  }
  function close() {
    formRef.current.close();
    setDraft(null);
    opener.current?.focus();
  }
  function field(name, value) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }
  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1500000
    ) {
      setError("Choose a PNG, JPEG, or WebP smaller than 1.5 MB.");
      return;
    }
    if (isLive) {
      setSaving(true);
      try {
        field("image", await uploadPhoto(file));
        setError("");
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      field("image", reader.result);
      setError("");
    };
    reader.onerror = () =>
      setError("Could not read this image. Try another file.");
    reader.readAsDataURL(file);
  }
  async function save(e) {
    e.preventDefault();
    const invalid = validateProduct(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    const product = {
      ...draft,
      id: draft.id || crypto.randomUUID(),
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      size: draft.size.trim(),
      price: Number(draft.price),
      stock: Number(draft.stock ?? 0),
      oldPrice: draft.oldPrice ? Number(draft.oldPrice) : undefined,
    };
    const next = draft.id
      ? products.map((p) => (p.id === draft.id ? product : p))
      : [...products, product];
    setSaving(true);
    try {
      if (!(await onSave(next, product))) {
        setError(
          "Browser storage is full or unavailable. Use a smaller photo or an HTTPS image URL.",
        );
        return;
      }
      setNotice(
        `${product.name} saved${isLive ? " to the store" : " to this browser"}.`,
      );
      close();
    } catch (e) {
      setError(e.message || "Could not save this product.");
    } finally {
      setSaving(false);
    }
  }
  function exportCatalog() {
    const blob = new Blob([JSON.stringify(products, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kalna-grocery-catalog.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const shown = products.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="workspace min-h-screen text-ink">
      <WorkspaceHeader label="Store studio" onBack={onBack} />
      <nav className="workspace-tabs" aria-label="Store management">
        {workspaceTabs.map(([id, label, Icon]) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-6xl p-5 md:p-8">
        <div className="mb-7 rounded-lg border border-[#ddd5ac] bg-[#fffbea] px-4 py-3 text-xs leading-5 text-[#685929]">
          {isLive ? (
            <>
              <strong>Connected store.</strong> Changes update the live grocery
              catalog. Only verified store administrators can edit products.{" "}
              <button
                className="ml-2 underline"
                onClick={() => backend.auth.signOut()}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <strong>Local design workspace.</strong> Changes are saved only in
              this browser. This is not a secured production admin panel and
              does not update a live store. Export your catalog to keep a
              backup.
            </>
          )}
        </div>
        {tab === "catalog" && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[.16em] text-muted">
                  THE EVERYDAY SELECTION
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Product catalog
                </h1>
                <p className="mt-2 text-sm text-muted">
                  Your products, prices and availability. All in one place.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportCatalog}
                  className="flex items-center gap-2 rounded-lg border bg-white px-4 py-3 text-xs font-semibold"
                >
                  <Download size={15} /> Export
                </button>
                <button
                  onClick={(e) => edit(blank, e)}
                  className="flex items-center gap-2 rounded-lg bg-forest px-4 py-3 text-xs font-semibold text-white"
                >
                  <Plus size={15} /> Add product
                </button>
              </div>
            </div>

            <div className="my-7 grid grid-cols-3 gap-3">
              {[
                ["Total products", products.length],
                [
                  "Visible in store",
                  products.filter((p) => p.active !== false).length,
                ],
                ["Categories", new Set(products.map((p) => p.category)).size],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-white p-4">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div role="status" className="mb-3 text-sm text-forest">
              {notice}
            </div>
            <div className="overflow-hidden rounded-xl border bg-white">
              <div className="relative border-b p-4">
                <Search
                  size={16}
                  className="absolute left-7 top-7 text-muted"
                />
                <input
                  type="search"
                  aria-label="Search admin products"
                  placeholder="Search products or categories"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full max-w-sm rounded-md border bg-[#f7f8f4] py-2 pl-10 pr-3 text-sm"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="catalog-table w-full text-left text-sm">
                  <thead className="bg-[#fafbf8] text-[10px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-5 py-3">Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="flex items-center gap-3 px-5 py-3">
                          <div className="admin-thumb w-12 shrink-0 rounded bg-cream">
                            <ProductArt product={p} />
                          </div>
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="mt-1 text-xs text-muted">{p.size}</p>
                          </div>
                        </td>
                        <td
                          data-label="Category"
                          className="text-xs text-muted"
                        >
                          {p.category}
                        </td>
                        <td data-label="Price">{money(p.price)}</td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] ${p.active !== false ? "bg-[#edf4e8] text-forest" : "bg-gray-100 text-gray-600"}`}
                          >
                            {p.active !== false ? "Visible" : "Hidden"}
                          </span>
                        </td>
                        <td className="pr-4">
                          <button
                            aria-label={`Edit ${p.name}`}
                            onClick={(e) => edit(p, e)}
                            className="rounded border p-2"
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!shown.length && (
                  <p className="p-10 text-center text-sm text-muted">
                    No matching products.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
        {tab === "settings" && (
          <div className="workspace-section">
            <p className="eyebrow">HOW YOUR STORE RUNS</p>
            <h1>Set up your day.</h1>
            <p className="section-description">
              Opening hours, delivery areas and the details customers count on.
            </p>
            <StoreSettings />
          </div>
        )}
        {tab === "orders" && (
          <div className="workspace-section">
            <p className="eyebrow">FROM BAG TO DOORSTEP</p>
            <h1>Every order, in view.</h1>
            {isLive ? <OrderList admin /> : <EmptyWorkspace />}
          </div>
        )}
        {tab === "drivers" && (
          <div className="workspace-section">
            <p className="eyebrow">THE LAST MILE</p>
            <h1>Your delivery team.</h1>
            {isLive ? <DriverManager /> : <EmptyWorkspace kind="drivers" />}
          </div>
        )}
      </main>
      <dialog
        className="editor-dialog"
        ref={formRef}
        aria-labelledby="editor-title"
        onCancel={close}
      >
        {draft && (
          <form ref={undefined} onSubmit={save} className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 id="editor-title" className="text-xl font-semibold">
                {draft.id ? "Edit product" : "Add product"}
              </h2>
              <button
                type="button"
                aria-label="Close editor"
                onClick={close}
                className="p-2"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mb-5 flex items-center gap-5 rounded-lg bg-cream p-4">
              <div className="admin-preview w-20">
                <ProductArt product={draft} />
              </div>
              <label className="cursor-pointer rounded-md border bg-white px-3 py-2 text-xs font-semibold">
                <ImagePlus size={14} className="mr-2 inline" /> Upload photo
                <input
                  aria-label="Upload product photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={upload}
                  className="mt-2 block max-w-[180px] text-[10px]"
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["name", "Product name", "text"],
                ["brand", "Brand", "text"],
                ["size", "Pack size", "text"],
                ["price", "Selling price (₹)", "number"],
                ["oldPrice", "Original price (optional)", "number"],
                ["stock", "Stock available", "number"],
              ].map(([key, label, type]) => (
                <label className="text-xs font-semibold" key={key}>
                  {label}
                  <input
                    autoFocus={key === "name"}
                    required={key !== "oldPrice"}
                    maxLength={key === "name" ? 100 : 120}
                    min={
                      key === "stock"
                        ? "0"
                        : type === "number"
                          ? "0.01"
                          : undefined
                    }
                    step={
                      key === "stock"
                        ? "1"
                        : type === "number"
                          ? "0.01"
                          : undefined
                    }
                    type={type}
                    value={draft[key] ?? ""}
                    onChange={(e) => field(key, e.target.value)}
                    className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm font-normal"
                  />
                </label>
              ))}
              <label className="text-xs font-semibold">
                Category
                <select
                  value={draft.category}
                  onChange={(e) => field("category", e.target.value)}
                  className="mt-1.5 w-full rounded-md border bg-white px-3 py-2.5 text-sm font-normal"
                >
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold sm:col-span-2">
                Photo URL (optional)
                <input
                  type="url"
                  placeholder="https://…"
                  value={
                    draft.image?.startsWith("data:") ? "" : draft.image || ""
                  }
                  onChange={(e) => field("image", e.target.value)}
                  className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm font-normal"
                />
              </label>
            </div>
            <label className="mt-5 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.active !== false}
                onChange={(e) => field("active", e.target.checked)}
              />{" "}
              Visible in storefront
            </label>
            {error && (
              <p role="alert" className="mt-4 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2 border-t pt-5">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border px-4 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-forest px-4 py-3 text-sm font-semibold text-white"
              >
                <Check size={15} /> {saving ? "Saving…" : "Save product"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
