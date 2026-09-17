import mongoose from "mongoose";
const { Schema } = mongoose;
const model = (name, definition, options = {}) =>
  mongoose.models[name] ||
  mongoose.model(name, new Schema(definition, options));
export const Account = model("GroceryAccount", {
  _id: String,
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});
export const LoginCode = model("GroceryLoginCode", {
  _id: String,
  hash: String,
  expiresAt: Date,
  sentAt: Date,
  attempts: { type: Number, default: 0 },
});
export const Settings = model("GrocerySettings", {
  revision: { type: Number, default: 0 },
  _id: { type: String, default: "store" },
  is_open: { type: Boolean, default: false },
  opens_at: { type: String, default: "08:00" },
  closes_at: { type: String, default: "22:00" },
  closed_message: {
    type: String,
    default: "We are closed for now. Please visit during store hours.",
  },
  delivery_pincodes: { type: [String], default: [] },
  delivery_fee: { type: Number, default: 0, min: 0 },
  minimum_order: { type: Number, default: 0, min: 0 },
  support_phone: { type: String, default: "" },
});
export const Product = model("GroceryProduct", {
  _id: String,
  name: { type: String, required: true, maxlength: 100 },
  brand: String,
  size: String,
  category: String,
  price: { type: Number, required: true, min: 0.01, max: 100000 },
  oldPrice: Number,
  image: String,
  color: String,
  label: String,
  type: String,
  active: { type: Boolean, default: false },
  stock: { type: Number, default: 0, min: 0 },
  created_at: { type: Date, default: Date.now },
});
const orderSchema = new Schema({
  _id: String,
  user_id: { type: String, index: true },
  request_key: String,
  items: [Schema.Types.Mixed],
  address: Schema.Types.Mixed,
  amount: { type: Number, min: 1 },
  currency: { type: String, default: "INR" },
  delivery_fee: Number,
  status: {
    type: String,
    enum: [
      "pending",
      "paid",
      "packing",
      "out_for_delivery",
      "delivered",
      "expired",
      "payment_review",
    ],
    default: "pending",
  },
  razorpay_order_id: { type: String, unique: true, sparse: true },
  razorpay_payment_id: { type: String, unique: true, sparse: true },
  driver_id: String,
  delivered_at: Date,
  created_at: { type: Date, default: Date.now },
  expires_at: Date,
});
orderSchema.index({ user_id: 1, request_key: 1 }, { unique: true });
export const Order =
  mongoose.models.GroceryOrder || mongoose.model("GroceryOrder", orderSchema);
export const Driver = model("GroceryDriver", {
  _id: String,
  name: String,
  phone: String,
  active: { type: Boolean, default: false },
});
export const DeliveryCode = model("GroceryDeliveryCode", {
  _id: String,
  code: String,
  attempts: { type: Number, default: 0 },
  locked_until: Date,
});
export const publicRow = (row) => {
  if (!row) return null;
  const { _id, __v, ...rest } = row.toObject ? row.toObject() : row;
  return { id: String(_id), ...rest };
};
