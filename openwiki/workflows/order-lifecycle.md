---
type: "Reference"
title: "Order Lifecycle: Placement to Payout"
openwiki_generated: true
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-945a9dbf41bc109f2aba8bd9
    resource: repo://backend/controllers/deliveryController.js
  - id: openwiki-source-e37396a539f937f2d3ab0757
    resource: repo://backend/controllers/orderController.js
  - id: openwiki-source-9971c4e28b5cd68ee3b9db77
    resource: repo://backend/controllers/paymentController.js
  - id: openwiki-source-7ad7eaa9420249ba12c0278c
    resource: repo://backend/controllers/payoutController.js
  - id: openwiki-source-ed1dc3b7385815b8d3ddf7ed
    resource: repo://backend/middleware/fraudDetectionMiddleware.js
  - id: openwiki-source-6b820c536d91a48100f9e6a1
    resource: repo://backend/models/orderModel.js
  - id: openwiki-source-342b36cfee63588f6492d392
    resource: repo://backend/utils/policy.js
  - id: openwiki-source-4584a3ec0244f29e2bbf2032
    resource: repo://frontend/src/redux/cartSlice.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---


# Order Lifecycle: Placement to Payout

## Front of house: the cart

Cart state lives entirely on the client in `frontend/src/redux/cartSlice.js` (Redux Toolkit), mirrored to `localStorage` under `cartItems`, `shippingAddress`, and `paymentMethod` (default `"Online"`) through a try/catch-safe storage wrapper. Key mechanics (`repo://frontend/src/redux/cartSlice.js#L1-L60`):

- **Single-shop invariant is enforced at add time**: if the cart already holds items from a different restaurant, `addToCart` wipes the cart before adding — the UI mirrors this behavior against the server-side check (`repo://frontend/src/redux/cartSlice.js#L66-L106`).
- Line-item identity is a computed `cartUniqueId` = `productId` + variant name + sorted addon names, so the same product with different variants/addons is a distinct line (`repo://frontend/src/redux/cartSlice.js#L34-L47`).
- `clearCart` also clears stale coupon keys from storage; `logout` empties everything and is chained with `userSlice.logout` via `logoutUser` (`repo://frontend/src/redux/cartSlice.js#L126-L157`).

Nothing here is trusted at order time — the server recomputes every price (below).

## Order creation: `POST /api/v1/orders`

Route: `protect, fraudDetection, addOrderItems` (`repo://backend/routes/orderRoutes.js#L42-L45`). `addOrderItems` in `backend/controllers/orderController.js` runs a gate sequence before any writes (`repo://backend/controllers/orderController.js#L33-L90`):

1. Non-empty items, integer positive quantities.
2. **Compliance gates** from `backend/utils/policy.js`: legal ordering hours (Asia/Kolkata, 10:00–22:00) and customer age ≥ 21 verified against the stored `dateOfBirth` (`repo://backend/utils/policy.js#L1-L25`).
3. Single-restaurant check across all `orderItems`.
4. **Heuristic fraud detection** (`backend/middleware/fraudDetectionMiddleware.js`): flags high-value first orders, repeated phone prefixes across accounts, and 7-day-cancel patterns — it only logs flags, never blocks (`repo://backend/middleware/fraudDetectionMiddleware.js#L8-L20`).

Everything after the gates runs inside a **MongoDB transaction** (`session.startTransaction()`), aborted on any error with a 400 to the client (`repo://backend/controllers/orderController.js#L88-L92`, `L499-L506`):

- Restaurant open/close validation against IST minutes of day.
- Product existence, `isAvailable`, stock sufficiency, and optional per-product availability schedules.
- **Atomic stock decrement with floor guard**: `findOneAndUpdate({ _id, countInStock: { $gte: qty } }, { $inc: { countInStock: -qty } })` — a lost race means "just went out of stock", aborting the transaction; a product hitting 0 with `autoDisable: true` flips `isAvailable` off (`repo://backend/controllers/orderController.js#L164-L191`).
- **Server-side price recomputation** ("never trust frontend prices"): item prices resolved from DB variants/addons overriding client-sent values, strict coupon validation (existence, active, expiry, min order vs **server** price, one use per user, discount recomputed server-side), shipping = ₹40 (free > ₹500 or SwadPass), surge multiplier applied, 5% tax, tip clamped to [0, 500], and a **15% restaurant commission** with precomputed `restaurantPayout` (`repo://backend/controllers/orderController.js#L193-L299`).
- **Wallet path**: `paymentMethod === "Wallet"` deducts atomically via `findOneAndUpdate` with a `walletBalance: { $gte: serverTotalPrice }` guard and pushes a debit transaction — insufficient balance fails the order; Wallet orders are `isPaid` immediately (`repo://backend/controllers/orderController.js#L303-L324`).
- The Order is created with `orderStatus: "Placed"` for COD/Wallet but `"Payment Pending"` with a 30-minute `expiresAt` for Online (`repo://backend/controllers/orderController.js#L326-L352`).
- ETA is computed (`calculateOrderETA`) and pushed into `etaUpdates` with reason `order_placed`; for non-Online payments, coupon usage is recorded inside the transaction (for Online it is deferred to payment verification) (`repo://backend/controllers/orderController.js#L354-L374`).

Post-commit, side effects are **non-blocking** (each wrapped in its own try/catch): SwadCoins loyalty (1 coin per ₹10 + 500 first-order bonus), customer/admin/restaurant emails, a `newOrderReceived` socket emit to the restaurant owner, push notifications, and `productUpdated` stock broadcasts to all viewers (`repo://backend/controllers/orderController.js#L376-L496`).

## Payment paths

Payment routes (`repo://backend/routes/paymentRoutes.js#L12-L18`): `GET /key` (public key), `POST /create`, `POST /verify` (all `protect`), and `POST /webhook` (public, from Razorpay; raw-body parsing happens globally in `server.js`).

**Create** (`paymentController.createRazorpayOrder`): validates a sanitized `orderId`, confirms ownership, then reads `totalPrice` **from the DB** (SEC-1), converts to paisa, and creates the Razorpay order with `notes: { orderId }` — that note is the binding used for verification later (`repo://backend/controllers/paymentController.js#L38-L75`).

**Verify** (`verifyPayment`) performs a five-layer check before marking paid (`repo://backend/controllers/paymentController.js#L79-L251`):

1. HMAC-SHA256 of `razorpay_order_id|razorpay_payment_id` with `RAZORPAY_KEY_SECRET` must equal `razorpay_signature` (tamper detection).
2. The Razorpay order is fetched server-side and its `notes.orderId` must match the internal order id (replay of a foreign payment id rejected; gateway unreachable → 502).
3. The payment is fetched from Razorpay; only `captured`/`authorized` statuses proceed.
4. Order ownership and **amount equality** (`payment.amount` vs `order.totalPrice` in paisa) are verified.
5. **Idempotency**: an already-paid order returns 200 with no side effects.

On success the order flips to `isPaid`/`paidAt`, `Payment Pending` → `Placed` with `expiresAt: null`, `paymentResult` is stored, the restaurant gets `newOrderReceived` over socket, and three emails (customer/admin/restaurant) are dispatched non-blockingly.

**Webhook** (`razorpayWebhook`): verifies `x-razorpay-signature` with `RAZORPAY_WEBHOOK_SECRET` against the **raw body** using `crypto.timingSafeEqual`; `payment.captured`/`payment.authorized` events apply an **atomic conditional update** `findOneAndUpdate({ _id orderId, isPaid: false }, ...)` so double delivery of the webhook is inert; notifications then fire once (`repo://backend/controllers/paymentController.js#L260-L391`).

The generic `PUT /:id/pay` marking route exists but is admin-only (owner-or-admin per BUG-1 fix) (`repo://backend/routes/orderRoutes.js#L143-L144`).

## Restaurant acceptance and delivery

Status transitions are strictly validated by `VALID_TRANSITIONS` (`Payment Pending → Placed/Cancelled → Preparing → Ready → Out for Delivery → Delivered`), restaurant owners can only touch their own restaurant's orders, `Delivered` **cannot** be set through this route (OTP flow only), and FCM push + socket emits notify the customer (`repo://backend/controllers/orderController.js#L616-L666`, `L729-L760`).

On `Ready`, **geospatial auto-assignment** runs if no partner is yet assigned: the nearest available `delivery_partner` within 5 km of the restaurant's coordinates (`$nearSphere`) is atomically claimed (`isAvailable: false`), a 4-digit `deliveryOTP` is generated with `crypto.randomInt` if absent, and the ETA is recalculated with reason `restaurant_ready` (`repo://backend/controllers/orderController.js#L670-L727`). Manual assignment (`PUT /:id/assign`) mirrors this atomically — claiming only an `isAvailable: true` partner prevents double-assignment (`repo://backend/controllers/deliveryController.js#L45-L127`).

The driver lifecycle `PUT /:id/delivery-action` accepts `accept`, `arrived_at_shop`, `picked_up` (→ `orderStatus: "Out for Delivery"`, customer emailed), `arrived_at_customer`, or `reject` (frees the partner, reverts order status to `Placed`/`Ready`) (`repo://backend/controllers/deliveryController.js#L132-L203`).

**Delivery completion** is OTP-gated (`PUT /:id/deliver`): only the assigned partner (admins bypass) may call it; wrong OTP increments `otpAttempts` with a hard cap of **5 attempts** (429 thereafter); correct OTP sets `isDelivered`/`deliveredAt`/`Delivered`, and for COD orders also marks them `isPaid` at the doorstep; the partner's `isAvailable` is freed (`repo://backend/controllers/deliveryController.js#L208-L292`). `deliveryOTP` is uniformly stripped from customer- and owner-facing responses and socket emits — only the assigned driver needs it (`repo://backend/controllers/orderController.js#L553-L557`).

## State and persistence

The Order document (`backend/models/orderModel.js`) is the lifecycle's single source of truth: embedded denormalized `orderItems` (with variant/addon snapshots and restaurant refs), shipping address, pricing fields (`itemsPrice`, `taxPrice`, `deliveryFee`, `surgePrice`, `tipAmount`, `restaurantCommission`, `restaurantPayout`), `payoutStatus` enum `pending|processing|paid|failed` plus `paidOutAt`, `refundStatus` enum, payment (`isPaid`, `paidAt`, `paymentResult`), delivery (`deliveryPartner`, `deliveryStatus`, `deliveryOTP` as a Number, `otpAttempts`, `driverLocation`), and `orderStatus` enum `Payment Pending|Placed|Preparing|Ready|Out for Delivery|Delivered|Cancelled` with a required `user` ref, `cancelledAt`/`cancellationReason`, and `expiresAt` (`repo://backend/models/orderModel.js#L85-L190`). `orderStatus` is indexed; listing endpoints exclude `Payment Pending` orders from admin/restaurant dashboards (they haven't committed yet), while carts/sockets/ETA live outside the model.

## Cancellation, refunds, and expiry

`PUT /:id/cancel` (owner, admin, or the owning restaurant owner) refuses already cancelled/delivered/"Out for Delivery" orders and runs its own **transaction**: for paid Online orders a Razorpay refund is initiated first (refund failure aborts cancellation), then wallet credit via atomic `$inc` + `refundStatus: "Processed"`, stock restore per item, coupon-usage release (`CouponUsage.deleteMany` for the order), freeing the delivery partner, and status update — all committed atomically, followed by socket/product/stock broadcasts and a cancellation email (`repo://backend/controllers/orderController.js#L908-L1061`).

`POST /:id/cancel-pending` handles un-paid Online orders: owner-only, `Payment Pending` status only, restores stock, releases coupon, then **deletes** the order outright (`repo://backend/controllers/orderController.js#L1066-L1121`). `expiresAt` (30 min for Online) is stored on the model but enforced lazily rather than by a dedicated reaper job — the webhooks and verify flow are the authoritative payment settlement paths.

## Restaurant payouts (commission settlement)

At query time, `GET /api/v1/payouts/restaurant/:id` aggregates paid, non-cancelled orders for a restaurant grouped by `payoutStatus` into pending/paid/processing earnings (admin or that restaurant's owner). `requestPayout` claims all currently-pending paid orders **atomically** (`updateMany` guarded on `payoutStatus: "pending"`; 409 if another request claims first) and creates a `Payout` record with the order ids and period; the admin `PATCH /api/v1/payouts/admin/:id/pay` sets the payout to `paid` with an optional UTR number and flips every included order to `payoutStatus: "paid"` + `paidOutAt` (`repo://backend/controllers/payoutController.js#L10-L140`, `L166-L200`). The commission itself (15% of net item value after discount) was fixed at order-creation time.

## Invariants worth preserving

- All money math and coupon computation is server-side; client-sent `totalPrice`/tax/shipping fields are ignored — including the Razorpay amount, taken from the DB order.
- Stock transitions are `countInStock: { $gte: qty }` guarded decrements and wallet operations are balance-guarded atomic updates — the double-guard pattern is the repo's answer to stock/wallet race conditions.
- Order creation, cancellation, and pending-cancellation each run inside a Mongo transaction; single-document status changes (verify, webhook, delivery) rely on conditional/idempotent updates instead.
- Login/auth, WebAuthn, age/hour compliance, and OTP caps guard every state-changing surface; the `newOrderReceived`, `orderUpdated`, and `productUpdated` socket events are emitted outside transactions (never blocking the money path).
- Test-visible seams: e2e script `backend/api_e2e_test.js` walks exactly this lifecycle — login → order create → Razorpay create → forged-but-signed payment verify (`repo://backend/api_e2e_test.js#L40-L115`).
