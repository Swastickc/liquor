---
type: concept
title: Liquor Compliance & Security Policies
description: The regulatory and anti-abuse rules that make SwadKart a legal liquor delivery platform — age gating at registration and checkout, legal ordering hours, single-shop checkout, OTP-verified handoff, payment signature verification, and fraud heuristics.
tags: [compliance, security, age-verification, payments, otp, fraud, razorpay]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-a9196f7ef9e1c05a924445a7
    resource: repo://backend/controllers/authController.js
  - id: openwiki-source-945a9dbf41bc109f2aba8bd9
    resource: repo://backend/controllers/deliveryController.js
  - id: openwiki-source-e37396a539f937f2d3ab0757
    resource: repo://backend/controllers/orderController.js
  - id: openwiki-source-9971c4e28b5cd68ee3b9db77
    resource: repo://backend/controllers/paymentController.js
  - id: openwiki-source-342b36cfee63588f6492d392
    resource: repo://backend/utils/policy.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---

# Liquor Compliance & Security Policies

## Why this section exists

Because the catalog is alcohol, several rules are non-negotiable legal constraints rather than product choices. They are enforced **server-side** — the frontend may hide UI, but the backend is the enforcer. The central source of truth is `backend/utils/policy.js` plus gates in the order, payment, delivery, and auth controllers.

## Age gating (21+)

- `backend/utils/policy.js` exports `LEGAL_MINIMUM_AGE = 21` and `isOfLegalAge(dateOfBirth)`, which computes exact calendar age. Missing DOB fails closed (`false`).
- **At registration**: `authController.registerUser` requires `dateOfBirth` among the mandatory fields and rejects under-age users before any account is created (`if (!isOfLegalAge(dateOfBirth))` → error). Email OTP follows via `crypto`-generated codes.
- **At checkout**: `addOrderItems` re-fetches the user and throws 403 if `dateOfBirth` is missing or the user is under 21. This double gate means an account created before the policy (or with a stale DOB) still cannot order liquor.

## Legal ordering hours

- Also in `policy.js`: `TIMEZONE = "Asia/Kolkata"`, `LEGAL_OPENING_HOUR = 10`, `LEGAL_CLOSING_HOUR = 22`, and `isWithinLegalOrderingHours()` evaluates the current hour in IST explicitly (not server-local time, so a UTC-hosted Render box cannot drift).
- `addOrderItems` rejects all order creation outside 10:00–22:00 IST with a 403 naming the legal window. Independently, the restaurant's own `openingTime`/`closingTime` (from the Restaurant model, default 09:00) is re-checked inside the order transaction using IST offset math (+330 minutes), including wrap-around windows where closing is past midnight.

## Single-shop checkout

A liquor order must come from exactly one licensed shop. Two layers enforce it:

1. **Cart layer** (`frontend/src/redux/cartSlice.js`): `addToCart` detects a restaurant mismatch and blocks the add (single-shop cart invariant client-side).
2. **Order layer** (`backend/controllers/orderController.js`): `addOrderItems` compares every `item.restaurant` against the first and throws 400 "Items must be from a single restaurant" — the client check is a UX guard only.

## Delivery handoff: physical ID check via OTP

Alcohol delivery legally ends with a hand-to-hand verification. The flow in `deliveryController.js`:

- When a partner is assigned, a 4-digit `deliveryOTP` is generated with `crypto.randomInt(1000, 10000)` (never `Math.random`).
- **OTP is only ever sent to the customer** (email at pick-up time and the driver's socket payload); it is explicitly **stripped from every customer-facing Socket emit** (`delete customerView.deliveryOTP`) so the customer — not a bystander watching the shared order room — proves identity.
- Driver sub-states: `accept → arrived_at_shop → picked_up (orderStatus → "Out for Delivery") → arrived_at_customer → deliver`.
- `updateOrderToDelivered` compares the submitted OTP, counts attempts in `order.otpAttempts`, hard-stops at **5 attempts** with 429, increments on each miss, and resets on success. Only the assigned partner (or an admin) can deliver. On success: `isDelivered`, `deliveredAt`, `orderStatus = "Delivered"`, and COD orders flip to `isPaid` at that moment; the partner's `isAvailable` flag is freed.

## Payment integrity (Razorpay)

`paymentController.js` implements a defense-in-depth chain:

1. `createRazorpayOrder` derives the amount from `dbOrder.totalPrice` in the DB (never trusts the frontend) and stores `notes.orderId`.
2. `verifyPayment` recomputes the HMAC-SHA256 signature of `order_id|payment_id` with `RAZORPAY_KEY_SECRET` and rejects mismatches; fetches the Razorpay order and payment objects server-side; verifies `notes.orderId` matches (anti-replay across orders); verifies `payment.amount` equals `order.totalPrice * 100` in paise; and is **idempotent** — an already-paid order returns 200 without duplicate emails/emits.
3. `razorpayWebhook` verifies `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET` over the exact raw body (Buffer preserved by the webhook carve-out in server.js) using `crypto.timingSafeEqual` (anti-timing-attack) and only processes `payment.captured`/`payment.authorized`.

Wallet payments are race-safe by construction: `addOrderItems` debits with `findOneAndUpdate({ _id, walletBalance: { $gte: serverTotalPrice } }, { $inc: { walletBalance: -serverTotalPrice } })` — the atomic match condition makes double-spend impossible — inside the same MongoDB transaction as stock decrement and order save.

## Anti-abuse gates

- **Fraud heuristics** (`fraudDetectionMiddleware`, non-blocking): high-value first order, ≥3 accounts sharing a 6-digit phone prefix, ≥3 cancellations in 7 days; flags logged and attached as `req.fraudFlags`.
- **Rate limits** (gateway page): auth endpoints 10/10 min, order creation 20/15 min, contact 5/hour — blunting enumeration and spam.
- **Coupon validation is server-only**: `addOrderItems` re-validates code/activity/expiry/minimum against **server-computed** item price and rejects reuse through a per-user `CouponUsage` record; for Online payments the usage record is written only after payment verification (BUG-08), preventing a "verify never happened" exploit path from consuming the coupon.
- **Registration hygiene**: `Math`-free OTP generation, generic password-reset messaging that prevents user enumeration (BUG-11), and rate limiting on verify/resend OTP.

## Failure behavior summary

- Outside legal hours or under-age → hard 403 at order creation, regardless of client state.
- Product unavailability / stock shortfall / closed shop → transaction aborts, stock rolls back (atomic decrement + session-based rollback), user gets a named error.
- Signature or amount mismatch on payment → 400, order stays unpaid; the order also carries `expiresAt` (30 min for Online) so unpaid "Payment Pending" orders age out rather than block stock.
- OTP brute force → 429 after 5 attempts; support intervention required.
