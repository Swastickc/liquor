import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import {
  Product,
  Order,
  Settings,
  Driver,
  DeliveryCode,
  publicRow,
} from "./models.js";
import { openNow } from "./hours.js";
export async function expireOrders() {
  const stale = await Order.find({
    status: "pending",
    expires_at: { $lt: new Date() },
  })
    .select("_id")
    .limit(100)
    .lean();
  for (const { _id } of stale)
    await mongoose.connection.transaction(async (session) => {
      const order = await Order.findOne({
        _id,
        status: "pending",
        expires_at: { $lt: new Date() },
      }).session(session);
      if (!order) return;
      for (const item of [...order.items].sort((a, b) =>
        a.id.localeCompare(b.id),
      ))
        await Product.updateOne(
          { _id: item.id },
          { $inc: { stock: item.quantity } },
          { session },
        );
      order.status = "expired";
      await order.save({ session });
    });
}
export async function reserveOrder(userId, body) {
  let result;
  try {
    await mongoose.connection.transaction(async (session) => {
      const existing = await Order.findOne({
        user_id: userId,
        request_key: body.requestKey,
      }).session(session);
      if (existing) {
        result = publicRow(existing);
        return;
      }
      const settings = await Settings.findById("store").session(session).lean();
      if (!openNow(settings)) throw new Error("Store is closed.");
      if (!settings.delivery_pincodes.includes(body.address.pincode))
        throw new Error("Outside delivery area.");
      if (
        (await Order.countDocuments({
          user_id: userId,
          created_at: { $gt: new Date(Date.now() - 3600000) },
        }).session(session)) >= 10
      )
        throw new Error("Too many orders. Please try later.");
      // Updating the settings row provides a shared transaction conflict point with store closure.
      await Settings.updateOne(
        { _id: "store" },
        { $inc: { revision: 1 } },
        { session },
      );
      let total = 0;
      const items = [];
      for (const item of [...body.items].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        const p = await Product.findOneAndUpdate(
          { _id: item.id, active: true, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true },
        );
        if (!p)
          throw new Error("An item is unavailable or has insufficient stock.");
        total += Math.round(p.price * 100) * item.quantity;
        items.push({
          id: p._id,
          name: p.name,
          size: p.size,
          price: p.price,
          quantity: item.quantity,
        });
      }
      if (total < Math.round(settings.minimum_order * 100))
        throw new Error("Minimum order not reached.");
      const [order] = await Order.create(
        [
          {
            _id: randomUUID(),
            user_id: userId,
            request_key: body.requestKey,
            items,
            address: body.address,
            amount: total + Math.round(settings.delivery_fee * 100),
            delivery_fee: settings.delivery_fee,
            expires_at: new Date(Date.now() + 900000),
          },
        ],
        { session },
      );
      result = publicRow(order);
    });
  } catch (e) {
    if (e.code === 11000) {
      const existing = await Order.findOne({
        user_id: userId,
        request_key: body.requestKey,
      });
      if (existing) return publicRow(existing);
    }
    throw e;
  }
  return result;
}
export async function confirmPayment(orderId, paymentId) {
  let status;
  await mongoose.connection.transaction(async (session) => {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found");
    if (order.razorpay_payment_id) {
      if (order.razorpay_payment_id !== paymentId)
        throw new Error("Payment conflict");
      status = order.status;
      return;
    }
    order.razorpay_payment_id = paymentId;
    order.status = order.status === "pending" ? "paid" : "payment_review";
    await order.save({ session });
    status = order.status;
  });
  return status;
}
export async function assignDriver(orderId, driverId, code) {
  await mongoose.connection.transaction(async (session) => {
    if (
      !(await Driver.exists({ _id: driverId, active: true }).session(session))
    )
      throw new Error("Driver not active");
    const order = await Order.findOne({
      _id: orderId,
      status: { $in: ["packing", "out_for_delivery"] },
    }).session(session);
    if (!order) throw new Error("Order not ready");
    await DeliveryCode.findOneAndUpdate(
      { _id: orderId },
      { $set: { code, attempts: 0, locked_until: null } },
      { session, upsert: true },
    );
    order.driver_id = driverId;
    order.status = "out_for_delivery";
    await order.save({ session });
  });
}
export async function completeDelivery(orderId, driverId, code) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const order = await Order.findOne({
      _id: orderId,
      driver_id: driverId,
    }).session(session);
    if (
      !order ||
      !(await Driver.exists({ _id: driverId, active: true }).session(session))
    ) {
      result = "forbidden";
      return;
    }
    if (order.status === "delivered") {
      result = "delivered";
      return;
    }
    if (order.status !== "out_for_delivery") {
      result = "not_ready";
      return;
    }
    const challenge = await DeliveryCode.findById(orderId).session(session);
    if (!challenge) {
      result = "not_ready";
      return;
    }
    if (challenge.locked_until > Date.now()) {
      result = "locked";
      return;
    }
    if (challenge.code !== code) {
      if (challenge.locked_until && challenge.locked_until <= Date.now())
        challenge.attempts = 0;
      challenge.attempts++;
      challenge.locked_until =
        challenge.attempts >= 5 ? new Date(Date.now() + 900000) : null;
      await challenge.save({ session });
      result = "invalid_code";
      return;
    }
    order.status = "delivered";
    order.delivered_at = new Date();
    await order.save({ session });
    await DeliveryCode.deleteOne({ _id: orderId }, { session });
    result = "delivered";
  });
  return result;
}
