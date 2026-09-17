import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import mongoose from "mongoose";
import User from "../models/userModel.js";
import sendEmail from "../utils/sendEmail.js";
import {
  Account,
  LoginCode,
  Settings,
  Product,
  Order,
  Driver,
  DeliveryCode,
  publicRow,
} from "./models.js";
import {
  expireOrders,
  reserveOrder,
  confirmPayment,
  assignDriver,
  completeDelivery,
} from "./service.js";
import {
  validSignature,
  validateCheckout,
  paymentMatches,
} from "./security.js";
import { openNow } from "./hours.js";
import { uploadGroceryPhoto } from "./photo.js";
const router = express.Router();
const key = () =>
  createHmac("sha256", process.env.JWT_SECRET)
    .update("kalna-grocery-session-v1")
    .digest("hex");
const digest = (email, code) =>
  createHmac("sha256", key()).update(`${email}|${code}`).digest("hex");
const error = (res, status, message) =>
  res.status(status).json({ error: message });
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((e) => {
    console.error("Grocery request failed:", e.name);
    if (!res.headersSent)
      error(
        res,
        503,
        "The store could not complete this request. Please retry. If payment was debited, check your orders first.",
      );
  });
const isAdmin = (req) => req.groceryUser?.role === "admin";
const admin = (req, res, next) =>
  isAdmin(req) ? next() : error(res, 403, "Admin access required.");
async function identity(req, res, next) {
  const token = req.cookies?.grocery_session;
  if (!token) return error(res, 401, "Verify your email to continue.");
  try {
    const claims = jwt.verify(token, key(), { audience: "kalna-grocery" });
    if (claims.guest === true)
      return error(res, 401, "Please verify your email to continue.");
    const account = await Account.findById(claims.sub).lean();
    if (!account) return error(res, 401, "Session expired.");
    const legacy = await User.findOne({ email: account.email })
      .select("role")
      .lean();
    req.groceryUser = {
      id: account._id,
      email: account.email,
      role: legacy?.role === "admin" ? "admin" : "user",
    };
    next();
  } catch {
    return error(res, 401, "Session expired. Please sign in again.");
  }
}
async function provider(path, body) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw new Error("Payment configuration missing");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Payment provider unavailable");
  return response.json();
}
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
let paymentCheck = { checkedAt: 0, valid: null };
router.get(
  "/health",
  wrap(async (_req, res) => {
    const testMode = process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_");
    if (testMode && Date.now() - paymentCheck.checkedAt > 300000) {
      paymentCheck.checkedAt = Date.now();
      try {
        await provider("orders?count=1");
        paymentCheck.valid = true;
      } catch {
        paymentCheck.valid = false;
      }
    }
    res.json({
      service: "kalna-grocery",
      databaseConnected: mongoose.connection.readyState === 1,
      paymentsConfigured: Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
      ),
      paymentMode: testMode
        ? "test"
        : process.env.RAZORPAY_KEY_ID
          ? "live"
          : "unconfigured",
      testKeyAuthentication: testMode ? paymentCheck.valid : null,
      emailConfigured: Boolean(
        (process.env.BREVO_API_KEY ||
          (process.env.SMTP_HOST && process.env.SMTP_PASSWORD)) &&
        (process.env.SMTP_FROM_EMAIL || process.env.SMTP_MAIL),
      ),
      photosConfigured: Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
      ),
      checkoutEnabled: process.env.GROCERY_CHECKOUT_ENABLED === "true",
    });
  }),
);
const otpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please wait 15 minutes." },
});
router.post(
  "/auth/send",
  otpLimit,
  wrap(async (req, res) => {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      return error(res, 400, "Enter a valid email.");
    const code = String(randomInt(100000, 1000000)),
      now = new Date();
    // Existing code cannot be overwritten more than once a minute, including concurrent requests.
    const previous = await LoginCode.findById(email).lean();
    if (previous?.sentAt > new Date(Date.now() - 60000))
      return error(res, 429, "Wait a minute before requesting another code.");
    try {
      const updated = await LoginCode.findOneAndUpdate(
        { _id: email, ...(previous ? { sentAt: previous.sentAt } : {}) },
        {
          $set: {
            hash: digest(email, code),
            sentAt: now,
            expiresAt: new Date(Date.now() + 600000),
            attempts: 0,
          },
        },
        { upsert: !previous, new: true },
      );
      if (!updated)
        return error(res, 429, "A code has already been requested.");
    } catch (e) {
      if (e.code === 11000)
        return error(res, 429, "A code has already been requested.");
      throw e;
    }
    await sendEmail({
      email,
      subject: "Your Kalna Daily sign-in code",
      message: `Your Kalna Daily code is ${code}. It expires in 10 minutes. Never share this sign-in code.`,
    });
    res.json({ sent: true });
  }),
);
router.post(
  "/auth/verify",
  otpLimit,
  wrap(async (req, res) => {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const code = req.body.token;
    if (!/^[0-9]{6}$/.test(code || ""))
      return error(res, 400, "Enter the six-digit code.");
    const challenge = await LoginCode.findOneAndUpdate(
      { _id: email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } },
      { new: true },
    );
    if (!challenge)
      return error(
        res,
        400,
        "Code expired or too many attempts. Request a new code.",
      );
    const match = timingSafeEqual(
      Buffer.from(digest(email, code), "hex"),
      Buffer.from(challenge.hash, "hex"),
    );
    if (!match) return error(res, 400, "Incorrect code.");
    const used = await LoginCode.deleteOne({
      _id: email,
      hash: challenge.hash,
    });
    if (!used.deletedCount) return error(res, 400, "Code already used.");
    const account = await Account.findOneAndUpdate(
      { email },
      { $setOnInsert: { _id: randomUUID(), email } },
      { upsert: true, new: true },
    );
    const token = jwt.sign({ sub: account._id }, key(), {
      audience: "kalna-grocery",
      expiresIn: "7d",
    });
    res.cookie("grocery_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/grocery",
      maxAge: 7 * 86400000,
    });
    res.json({ user: { id: account._id, email: account.email } });
  }),
);
router.post("/auth/logout", (_req, res) => {
  res.clearCookie("grocery_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/grocery",
  });
  res.json({ signedOut: true });
});
router.get("/auth/session", identity, (req, res) =>
  res.json({ user: req.groceryUser }),
);
router.get(
  "/catalog",
  wrap(async (req, res) =>
    res.json(
      (await Product.find({ active: true }).sort({ created_at: 1 }).lean()).map(
        publicRow,
      ),
    ),
  ),
);
router.get(
  "/settings",
  wrap(async (req, res) => {
    const settings = await Settings.findById("store").lean();
    res.json(
      settings
        ? { ...publicRow(settings), id: 1 }
        : {
            id: 1,
            is_open: false,
            opens_at: "08:00",
            closes_at: "22:00",
            delivery_pincodes: [],
            delivery_fee: 0,
            minimum_order: 0,
            closed_message: "The store is being prepared.",
            support_phone: "",
          },
    );
  }),
);
router.post(
  "/webhook",
  wrap(async (req, res) => {
    const raw = req.body;
    if (
      !Buffer.isBuffer(raw) ||
      !validSignature(
        raw,
        req.headers["x-razorpay-signature"],
        process.env.GROCERY_RAZORPAY_WEBHOOK_SECRET ||
          process.env.RAZORPAY_WEBHOOK_SECRET,
      )
    )
      return error(res, 401, "Invalid webhook signature.");
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return error(res, 400, "Invalid event.");
    }
    if (event.event !== "payment.captured") return res.json({ received: true });
    const id = event.payload?.payment?.entity?.id;
    if (!/^pay_[a-zA-Z0-9]+$/.test(id || ""))
      return error(res, 400, "Invalid payment.");
    const payment = await provider(`payments/${id}`);
    const order = await Order.findOne({
      razorpay_order_id: payment.order_id,
    }).lean();
    // The same payment account can also receive orders from the original app.
    if (!order) {
      const paymentOrder = await provider(`orders/${payment.order_id}`);
      if (!paymentOrder.notes?.grocery_order_id)
        return res.json({ received: true, unrelated: true });
      return error(res, 503, "Grocery order not linked yet. Retry.");
    }
    if (!paymentMatches(payment, order))
      return error(res, 400, "Payment does not match.");
    res.json({
      received: true,
      status: await confirmPayment(order._id, payment.id),
    });
  }),
);
router.use(identity);
router.get(
  "/admin/catalog",
  admin,
  wrap(async (req, res) =>
    res.json(
      (await Product.find().sort({ created_at: 1 }).lean()).map(publicRow),
    ),
  ),
);
router.post(
  "/photo",
  admin,
  wrap(async (req, res) => {
    try {
      res.json({ url: await uploadGroceryPhoto(req.body.image) });
    } catch {
      return error(
        res,
        400,
        "Could not upload photo. Use a valid PNG, JPEG or WebP under 1.5 MB and check photo storage configuration.",
      );
    }
  }),
);
router.post(
  "/catalog",
  admin,
  wrap(async (req, res) => {
    const p = req.body;
    const categories = [
      "Premium Beverages",
      "Mixers",
      "Glassware",
      "Snacks",
      "Pantry",
    ];
    if (
      typeof p.id !== "string" ||
      p.id.length > 100 ||
      !p.name?.trim() ||
      p.name.length > 100 ||
      typeof p.brand !== "string" ||
      !p.brand.trim() ||
      typeof p.size !== "string" ||
      !p.size.trim() ||
      !categories.includes(p.category) ||
      !Number.isFinite(p.price) ||
      p.price <= 0 ||
      p.price > 100000 ||
      !Number.isInteger(p.stock) ||
      p.stock < 0 ||
      typeof p.active !== "boolean" ||
      (p.oldPrice != null &&
        (!Number.isFinite(p.oldPrice) || p.oldPrice < p.price)) ||
      typeof p.image !== "string" ||
      (p.image && !/^https:\/\//i.test(p.image))
    )
      return error(
        res,
        400,
        "Check product fields, price, stock and HTTPS photo URL.",
      );
    const fields = [
      "name",
      "brand",
      "size",
      "category",
      "price",
      "oldPrice",
      "image",
      "color",
      "label",
      "type",
      "active",
      "stock",
    ];
    const row = Object.fromEntries(
      fields.map((k) => [k, p[k] ?? (k === "oldPrice" ? null : "")]),
    );
    if (p._originalStock !== undefined) {
      const updated = await Product.findOneAndUpdate(
        { _id: p.id, stock: p._originalStock },
        { $set: row },
        { new: true, runValidators: true },
      );
      if (!updated)
        return error(
          res,
          409,
          "Stock changed. Reload and reopen this product.",
        );
    } else await Product.create({ _id: p.id, ...row });
    res.json({ saved: true });
  }),
);
router.post(
  "/settings",
  admin,
  wrap(async (req, res) => {
    const s = req.body;
    const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (
      typeof s.is_open !== "boolean" ||
      !clock.test(s.opens_at) ||
      !clock.test(s.closes_at) ||
      !Array.isArray(s.delivery_pincodes) ||
      s.delivery_pincodes.length > 100 ||
      !s.delivery_pincodes.every(
        (p) => typeof p === "string" && /^\d{6}$/.test(p),
      ) ||
      ![s.delivery_fee, s.minimum_order].every(
        (v) => Number.isFinite(v) && v >= 0 && v <= 100000,
      ) ||
      typeof s.closed_message !== "string" ||
      s.closed_message.length > 200 ||
      typeof s.support_phone !== "string" ||
      (s.support_phone && !/^\d{10}$/.test(s.support_phone))
    )
      return error(
        res,
        400,
        "Check hours, service area, charges and contact details.",
      );
    const fields = [
      "is_open",
      "opens_at",
      "closes_at",
      "delivery_pincodes",
      "delivery_fee",
      "minimum_order",
      "closed_message",
      "support_phone",
    ];
    await Settings.findOneAndUpdate(
      { _id: "store" },
      { $set: Object.fromEntries(fields.map((k) => [k, s[k]])) },
      { upsert: true, runValidators: true },
    );
    res.json({ saved: true });
  }),
);
router.get(
  "/orders",
  wrap(async (req, res) => {
    let filter = { user_id: req.groceryUser.id };
    if (req.query.driver === "true") {
      if (!(await Driver.exists({ _id: req.groceryUser.id, active: true })))
        return error(res, 403, "Driver not approved.");
      filter = {
        driver_id: req.groceryUser.id,
        status: { $in: ["out_for_delivery", "delivered"] },
      };
    } else if (req.query.admin === "true") {
      if (!isAdmin(req)) return error(res, 403, "Admin access required.");
      filter = {};
    }
    res.json(
      (await Order.find(filter).sort({ created_at: -1 }).limit(100).lean()).map(
        publicRow,
      ),
    );
  }),
);
router.get(
  "/delivery-codes",
  wrap(async (req, res) => {
    const orders = await Order.find({
      user_id: req.groceryUser.id,
      status: "out_for_delivery",
    })
      .select("_id")
      .lean();
    res.json(
      (
        await DeliveryCode.find({
          _id: { $in: orders.map((o) => o._id) },
        }).lean()
      ).map((c) => ({ order_id: c._id, code: c.code })),
    );
  }),
);
router.get(
  "/drivers",
  wrap(async (req, res) => {
    const drivers = await Driver.find(
      isAdmin(req) ? {} : { _id: req.groceryUser.id },
    ).lean();
    res.json(drivers.map((d) => ({ ...publicRow(d), user_id: d._id })));
  }),
);
router.post(
  "/driver-enrol",
  wrap(async (req, res) => {
    if (req.groceryUser.guest)
      return error(
        res,
        403,
        "Drivers must sign in with a verified staff account.",
      );
    const { name, phone } = req.body;
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.length > 100 ||
      !/^\d{10}$/.test(phone || "")
    )
      return error(res, 400, "Enter your name and 10-digit phone.");
    if (await Driver.exists({ _id: req.groceryUser.id }))
      return error(res, 409, "Driver profile already exists.");
    await Driver.create({
      _id: req.groceryUser.id,
      name: name.trim(),
      phone,
      active: false,
    });
    res.json({ requested: true });
  }),
);
router.post(
  "/approve-driver",
  admin,
  wrap(async (req, res) => {
    if (typeof req.body.active !== "boolean")
      return error(res, 400, "Invalid approval.");
    const result = await Driver.updateOne(
      { _id: String(req.body.driverId) },
      { $set: { active: req.body.active } },
    );
    if (!result.matchedCount) return error(res, 404, "Driver not found.");
    res.json({ updated: true });
  }),
);
router.post(
  "/assign-driver",
  admin,
  wrap(async (req, res) => {
    await assignDriver(
      String(req.body.orderId),
      String(req.body.driverId),
      String(randomInt(100000, 1000000)),
    );
    res.json({ status: "out_for_delivery" });
  }),
);
router.post(
  "/complete-delivery",
  wrap(async (req, res) => {
    if (!/^[0-9]{6}$/.test(req.body.code || ""))
      return error(res, 400, "Enter the delivery code.");
    const status = await completeDelivery(
      String(req.body.orderId),
      req.groceryUser.id,
      req.body.code,
    );
    if (status !== "delivered")
      return error(
        res,
        status === "forbidden" ? 403 : 409,
        status === "locked"
          ? "Too many attempts. Wait 15 minutes."
          : "Check the delivery code and assignment.",
      );
    res.json({ status });
  }),
);
router.post(
  "/update-order",
  admin,
  wrap(async (req, res) => {
    if (req.body.previousStatus !== "paid" || req.body.status !== "packing")
      return error(res, 400, "Invalid status transition.");
    const order = await Order.findOneAndUpdate(
      { _id: String(req.body.orderId), status: "paid" },
      { $set: { status: "packing" } },
      { new: true },
    );
    if (!order) return error(res, 409, "Order changed. Refresh.");
    res.json(publicRow(order));
  }),
);
router.post(
  "/create-order",
  rateLimit({
    windowMs: 3600000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  wrap(async (req, res) => {
    if (process.env.GROCERY_CHECKOUT_ENABLED !== "true")
      return error(res, 503, "The store is not accepting orders yet.");
    const settings = await Settings.findById("store").lean();
    if (!openNow(settings))
      return error(res, 409, settings?.closed_message || "Store is closed.");
    const invalid = validateCheckout(req.body, settings.delivery_pincodes);
    if (invalid) return error(res, 400, invalid);
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      return error(res, 503, "Payments are not configured.");
    await expireOrders();
    let order;
    try {
      order = await reserveOrder(req.groceryUser.id, req.body);
    } catch (e) {
      return error(res, 409, e.message);
    }
    if (order.status !== "pending")
      return error(res, 409, "Order is no longer pending. Check your orders.");
    let paymentOrder;
    if (order.razorpay_order_id)
      paymentOrder = await provider(`orders/${order.razorpay_order_id}`);
    else {
      paymentOrder = await provider("orders", {
        amount: order.amount,
        currency: "INR",
        receipt: order.id,
        notes: { grocery_order_id: order.id },
      });
      const linked = await Order.findOneAndUpdate(
        { _id: order.id, razorpay_order_id: { $exists: false } },
        { $set: { razorpay_order_id: paymentOrder.id } },
        { new: true },
      );
      if (!linked) {
        const existing = await Order.findById(order.id).lean();
        paymentOrder = await provider(`orders/${existing.razorpay_order_id}`);
      }
    }
    res.json({
      orderId: order.id,
      key: process.env.RAZORPAY_KEY_ID,
      paymentOrderId: paymentOrder.id,
      amount: order.amount,
      currency: "INR",
    });
  }),
);
router.post(
  "/verify-payment",
  wrap(async (req, res) => {
    const { orderId, paymentId, signature } = req.body;
    if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId || ""))
      return error(res, 400, "Invalid payment.");
    const order = await Order.findOne({
      _id: String(orderId),
      user_id: req.groceryUser.id,
    }).lean();
    if (!order) return error(res, 404, "Order not found.");
    if (
      !validSignature(
        `${order.razorpay_order_id}|${paymentId}`,
        signature,
        process.env.RAZORPAY_KEY_SECRET,
      )
    )
      return error(res, 400, "Payment signature mismatch.");
    const payment = await provider(`payments/${paymentId}`);
    if (!paymentMatches(payment, order))
      return error(
        res,
        409,
        "Payment is not captured or does not match. Check your orders shortly.",
      );
    res.json({
      orderId: order._id,
      status: await confirmPayment(order._id, paymentId),
    });
  }),
);
export default router;
