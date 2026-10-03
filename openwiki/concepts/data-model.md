---
type: concept
title: Data Model & Persistence
description: The Mongoose schemas backing SwadKart — User with roles/wallet/biometrics/loyalty, Order with lifecycle enums and payout fields, Product with liquor-domain fields and scheduling, Restaurant with GeoJSON — plus caching strategy and persistence invariants.
tags: [data-model, mongoose, mongodb, schema, caching, redis]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-c07db992cb4de5c4d4802359
    resource: repo://backend/config/redis.js
  - id: openwiki-source-e37396a539f937f2d3ab0757
    resource: repo://backend/controllers/orderController.js
  - id: openwiki-source-6b820c536d91a48100f9e6a1
    resource: repo://backend/models/orderModel.js
  - id: openwiki-source-af661313f5212dc4895a7049
    resource: repo://backend/models/productModel.js
  - id: openwiki-source-ac4733bbe7c812fad9552adf
    resource: repo://backend/models/restaurantModel.js
  - id: openwiki-source-6a73266daf1cc5615afd264c
    resource: repo://backend/models/userModel.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---

# Data Model & Persistence

MongoDB via Mongoose is the only durable store. Models live in `backend/models/` (13 top-level files; several older features — Coupon, CouponUsage, subscription — are imported only in commented-out code paths but still referenced at runtime in `orderController`). Embedded-subdocument style dominates: money, delivery, and policy state live directly on documents, which keeps a whole order readable and transactional within one session.

## User (`models/userModel.js`)

- **Identity & access**: `name`, unique lowercase `email`, bcrypt `password` (`minlength 6`), `phone`/`phoneVerified`, `dateOfBirth` (compliance age gate input), `role` enum `user | admin | delivery_partner | restaurant_owner` (plus derived `isAdmin`), `isVerified`, OTP fields (`otp`, `otpExpires`), reset tokens, and `tokenVersion` — bumped on password change and compared inside JWT verification to invalidate old tokens.
- **Delivery-partner geospatial**: `currentLocation` GeoJSON Point and `isAvailable` (assignment mutex consumed/updated atomically).
- **Money**: `walletBalance` + capped `walletTransactions` ledger (last 100 kept by pre-save hook; each entry is amount/Debit|Credit/description/date).
- **WebAuthn**: `biometricCredentials` array (`credentialID`, `credentialPublicKey` Buffer, `counter`, `transports`, `deviceType`, `backedUp`), `currentChallenge`, `isBiometricEnabled` — used by biometric app-lock routes.
- **Push & loyalty**: `fcmToken`; `swadCoins` (min 0); referral fields (`referralCode` unique sparse uppercase, `referredBy`, `referralRewardClaimed`); SwadPass fields (`hasSwadPass`, `swadPassType`, `swadPassExpiry`, etc.); gamification (`orderStreak`, `longestStreak`, `lastOrderDate`, badged array capped at 50); price-drop `subscribedProducts`; chatbot-server-side `cartItems`.
- **Hooks/methods**: `matchPassword` (bcrypt compare); pre-save syncs `isAdmin` from role, hashes modified password (salt 10), auto-generates a 6-char referral code for users, trims `walletTransactions` to 100 and `badges` to 50 to prevent unbounded embedded growth.

## Order (`models/orderModel.js`)

The lifecycle state machine lives here (enums are the source of truth):

- `orderItems[]`: `product`, required `restaurant` per item (single-shop checks rely on this), `name/qty/image/price`, `selectedVariant` object, `selectedAddons[]`.
- `shippingAddress`: full details including `phone` (fraud checks key on it) and optional `lat/lng`.
- `paymentMethod` enum `COD | Online | Wallet`; `paymentResult` populated on online success.
- **Pricing**: `itemsPrice`, `taxPrice`, `shippingPrice`, `couponCode`, `couponDiscount`, `totalPrice`, plus `tipAmount` (capped ₹500), `deliveryFee`, `surgePrice`.
- **Commission/payout (FEAT-2)**: `restaurantCommission`, `restaurantPayout`, `payoutStatus` enum `pending|processing|paid|failed`, `paidOutAt` — consumed by payout routes.
- **Payment/delivery state**: `isPaid`, `paidAt`, `refundStatus` (`None|Pending|Processed|Failed`), `isDelivered`, `deliveredAt`.
- **Delivery**: `deliveryPartner` ref, `deliveryStatus` enum `None|Assigned|Accepted|Rejected|Out for Delivery|Delivered` (controller extends to At Shop/Picked Up/Arrived at Customer transiently), `deliveryOTP` (number, stripped before customer emits), `otpAttempts`, `driverLocation` (lat/lng/heading/speed/updatedAt persisted per update), `estimatedDeliveryAt` + `etaUpdates[]` audit trail.
- **Lifecycle**: `orderStatus` enum `Payment Pending | Placed | Preparing | Ready | Out for Delivery | Delivered | Cancelled`; `cancelledAt`, `cancellationReason`, `expiresAt` (30-min auto-expiry stamp for "Payment Pending" online orders).
- **Indexes**: `user`, `orderItems.restaurant`, `orderStatus`, `createdAt DESC`, compound `deliveryPartner+deliveryStatus`, compound `isPaid + createdAt DESC` — covering the three dashboards (customer, driver, restaurant) and admin reporting.

## Product (`models/productModel.js`)

Liquor-domain catalog item: `restaurant` + `user` ownership, `name`, `brand`, `bottleSize` (default "750ml"), `type` enum `Beer|Wine|Spirit|Mixer|Other`, `abv`, `price`/`mrp`, `category` (survives as a generic string), and `tags[]` for retrieval.

- **Customization**: `variants[]` and `addons[]` name/price pairs — order-time pricing looks up by name against this DB truth.
- **Inventory (FEAT-14)**: `countInStock`, `isAvailable`, `autoDisable` (default true — flips `isAvailable=false` when stock hits 0 at order time), `lastRestocked`.
- **Scheduling (FEAT-7)**: `scheduleEnabled` + `schedule{days[] of Mon..Sun, startTime, endTime "HH:mm"}` — checked during order creation.
- **Reviews**: embedded `reviews[]` with rating/numReviews aggregates.
- **Indexes**: restaurant, category, restaurant+type, restaurant+isAvailable, and a **weighted text index** (name 10, tags 5, category 3, description 1) purpose-built for the chatbot's RAG retrieval (`retrievalService`).

## Restaurant (`models/restaurantModel.js`)

Licensed shop: required `owner` ref (used for authorization scoping and socket rooms), `location` GeoJSON Point with a `2dsphere` index (proximity queries), `serviceRadiusKm` (default 5), `licenseNumber`, operational flags (`isVerified`, `isActive`, `isDummy`, `isOpenNow`), `openingTime`/`closingTime` "HH:mm" strings (defaults 09:00/23:00 — re-checked in IST at order time), phone, embedded reviews, and a performance-score cluster (FEAT-9 `performanceScore` 0–100 plus sub-metrics with `lastCalculatedAt`). Composite indexes cover owner lookup, `isActive+isVerified`, and `isActive+isOpenNow` for the customer-facing listing.

## Supporting models

`conversationModel` (chat history + messages), `notificationModel` (in-app notification feed), `emergencyModel` (driver SOS records), `payoutModel` (restaurant payout runs), `reservationModel`, `coinTransactionModel`/`referralModel`/`supportMessageModel`/`groupOrderModel` for the partially commented-out feature set. Coupon models no longer exist as files (imports are commented out), yet `orderController` still calls `Coupon.findOne`/`CouponUsage` when a `couponCode` is supplied — passing coupons through order creation currently fails at that lookup, an active code/comment drift to be aware of when touching checkout.

## Cache & persistence behavior

- All schemas use `{ timestamps: true }`.
- `backend/config/redis.js` is the shared cache abstraction: real `redis` client if `REDIS_URL` is present (reconnect capped at 10 tries, then gives up), otherwise an in-memory Map client capped at 1000 entries with LRU eviction and a compatible API (`get/setEx/del/ping/incr/sadd/smembers...`; `incr` throws on the in-memory backend, so anything relying on atomic counters must tolerate cache errors). `utils/cache.js` wraps get/set/tag-invalidation on top of this client, and `cacheMiddleware` uses it with stampede locks.
- Money mutations (wallet debit, stock decrement) are never read-modify-write on plain documents: they go through `findOneAndUpdate` with match conditions, run inside explicit MongoDB sessions/transactions where an order is created, and rely on `retryWrites: true` + majority write concern from `config/db.js`.

## Failure behavior

- MongoDB connection failure escalates: 5 retries with doubling delay, then `process.exit(1)` so the platform restarts the process.
- Embedding choices are deliberate for low volume (restaurant reviews uncapped; user badges/wallet ledger capped) — scaling out restaurants with heavy review traffic would be the first thing to revisit.
- Unpaid online orders expire via `expiresAt` rather than holding stock indefinitely; cancelled orders retain `restaurantCommission/payout` fields unchanged but set `payoutStatus` within cancellation flows.
