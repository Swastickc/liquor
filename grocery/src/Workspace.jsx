import React from "react";
import { ArrowUpRight, Package, Truck, Store, ShoppingBag } from "lucide-react";
export function WorkspaceHeader({ label, onBack }) {
  return (
    <header className="workspace-header">
      <a href="#" className="store-brand">
        kalna<span>daily</span>
      </a>
      <span className="workspace-label">{label}</span>
      <button
        onClick={onBack || (() => (window.location.hash = ""))}
        className="workspace-back"
      >
        Visit store <ArrowUpRight size={15} />
      </button>
    </header>
  );
}
export function EmptyWorkspace({ kind = "orders" }) {
  const driver = kind === "drivers";
  return (
    <div className="workspace-empty">
      <span className="empty-icon">
        {driver ? <Truck size={30} /> : <ShoppingBag size={30} />}
      </span>
      <p className="eyebrow">
        {driver ? "YOUR DELIVERY TEAM" : "ORDER MANAGEMENT"}
      </p>
      <h2>
        {driver ? "A place for your people." : "Ready for your first order."}
      </h2>
      <p>
        {driver
          ? "Approve your delivery partners, assign their orders and keep track of each handover."
          : "Paid orders appear here. Pack the bag, assign a driver and follow it all the way to the customer."}
      </p>
      <span className="workspace-preview-note">
        Connect the store to manage{" "}
        {driver ? "delivery partners" : "customer orders"}.
      </span>
    </div>
  );
}
export const workspaceTabs = [
  ["catalog", "Products", Package],
  ["orders", "Orders", ShoppingBag],
  ["drivers", "Delivery", Truck],
  ["settings", "Store settings", Store],
];
