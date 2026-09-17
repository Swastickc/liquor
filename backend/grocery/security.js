import { createHmac, timingSafeEqual } from "node:crypto";
export function validSignature(message, signature, secret) {
  if (
    !secret ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function validateCheckout(body, allowedPincodes) {
  if (
    !body ||
    !Array.isArray(body.items) ||
    !body.items.length ||
    body.items.length > 40
  )
    return "Invalid bag.";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.requestKey || "",
    )
  )
    return "Invalid request ID.";
  const ids = new Set();
  for (const item of body.items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      item.id.length > 100 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20 ||
      ids.has(item.id)
    )
      return "Invalid bag quantity.";
    ids.add(item.id);
  }
  const a = body.address;
  if (
    !a ||
    typeof a.name !== "string" ||
    a.name.trim().length < 2 ||
    a.name.length > 100 ||
    typeof a.line !== "string" ||
    a.line.trim().length < 8 ||
    a.line.length > 300 ||
    !/^\d{10}$/.test(a.phone || "") ||
    !/^\d{6}$/.test(a.pincode || "")
  )
    return "Enter a complete delivery address and 10-digit phone number.";
  if (!allowedPincodes?.includes(a.pincode))
    return "Delivery is not available for this pincode.";
  return "";
}
export function paymentMatches(payment, order) {
  return (
    payment.status === "captured" &&
    payment.order_id === order.razorpay_order_id &&
    payment.amount === order.amount &&
    payment.currency === order.currency
  );
}
