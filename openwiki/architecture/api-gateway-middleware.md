---
type: concept
title: API Gateway, Security Middleware & Auth
description: How backend/server.js processes every request — environment validation, CORS whitelist, CSRF defense, NoSQL sanitization, layered rate limiters, JWT auth with cookie fallback, RBAC, and centralized error handling.
tags: [backend, security, middleware, authentication, express, server-js]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T12:24:36.041Z
sources:
  - id: openwiki-source-26e791eee19d210c3de5dd59
    resource: repo://backend/middleware/authMiddleware.js
  - id: openwiki-source-989cca1c4aabcabbd1cf1a27
    resource: repo://backend/middleware/cacheMiddleware.js
  - id: openwiki-source-d830c4b00ab4447330ac4cb7
    resource: repo://backend/middleware/errorMiddleware.js
  - id: openwiki-source-ed1dc3b7385815b8d3ddf7ed
    resource: repo://backend/middleware/fraudDetectionMiddleware.js
  - id: openwiki-source-d5ca2bc2abc7ff170b1df35b
    resource: repo://backend/middleware/roleMiddleware.js
  - id: openwiki-source-ab975d6f2b734f6119ff4cb1
    resource: repo://backend/server.js
generated: { by: "opencode", at: "2026-10-03T12:24:36.041Z" }
---

# API Gateway, Security Middleware & Auth

## Ownership

`backend/server.js` is the single gateway for all HTTP and Socket.io traffic. It owns the Express app, the Socket.io server, and the ordered middleware chain. Per-request auth and authorization live in `backend/middleware/authMiddleware.js` and `backend/middleware/roleMiddleware.js`; generic error handling lives in `backend/middleware/errorMiddleware.js`. There is no separate gateway service — every cross-cutting concern is Express middleware registered in `server.js`.

## Startup gates: environment validation

Before anything listening happens, `validateEnv()` runs at module load (`backend/server.js`):

- Always required: `JWT_SECRET`, `MONGO_URI`.
- Required in production additionally: `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `COOKIE_SECRET`.
- Production hard checks: `JWT_SECRET` must be ≥ 32 chars, else the process exits with code 1.
- Production warnings (not fatal): missing `RAZORPAY_KEY_ID`, `CLOUDINARY_CLOUD_NAME`, `BREVO_API_KEY`, `COOKIE_SECRET`; a `rzp_test_` Razorpay key; `FRONTEND_URL` pointing at localhost.

After validation, `connectDB()` is called and the HTTP server wraps Express so Socket.io shares the same port (default 8000).

## Request pipeline order

An inbound request traverses, in registration order:

1. **Raw-body carve-out for webhooks**: `POST /api/grocery/webhook` and `POST /api/v1/payment/webhook` each get `express.raw({ type: "application/json", limit: "100kb" })` before `express.json()` so Razorpay HMAC verification sees the exact bytes Razorpay signed.
2. **Body limits**: `express.json({ limit: "1mb" })` and `express.urlencoded({ extended: true, limit: "1mb" })` cap payload size (DoS defense).
3. **`helmet()`** security headers and **`compression()`**.
4. **`cookieParser(process.env.COOKIE_SECRET)`** — secret-signed cookie parsing, needed for the `jwt` auth cookie and for the Socket.io handshake fallback.
5. **`safeMongoSanitize`** (defined inline in `server.js`): recursively strips any key starting with `$` or containing `.` from `req.body`, `req.query`, and `req.params`, killing NoSQL injection operators. It deliberately skips `Buffer` bodies so webhook raw bytes survive.
6. **`csrfProtection`** (custom, in `server.js`): skipped for GET/HEAD/OPTIONS and for an explicit `csrfExemptPaths` list (webhook, register/login/logout, OTP, password reset, contact, Google auth, `POST /api/v1/orders` creation, `/ping`). Cookie-authenticated mutating requests must carry the `X-Requested-With` header (browsers cannot set this header cross-origin); requests carrying an `Authorization: Bearer` header are exempt because CSRF targets cookie auth, not header auth.
7. **CORS**: exact-origin whitelist — `http(s)://localhost:5173`, `https://swadkart.vercel.app`, `process.env.FRONTEND_URL`, `https://kalna-daily.vercel.app`, `https://swadkart-5wtf.onrender.com`. Same-origin/no-Origin requests pass; anything else raises `CORS Protocol Violation`. credentials are enabled. The same whitelist guards the Socket.io handshake CORS.
8. **Rate limiters** (`express-rate-limit`):
   - Global API: 200 requests / 15 min per IP on `/api`.
   - Auth limiter: 10 requests / 10 min on login, register, verify-email, password forgot/reset.
   - Contact support: 5 requests / hour.
   - Order creation: 20 POSTs / 15 min on `/api/v1/orders` (POST method only; GET/PUT/DELETE unaffected).
   - Health endpoint: its own 10/min limiter.
9. **Route-level middleware** per route registration: `protect` (auth), `authorizeRoles(...)` / `adminOnly` / `adminOrRestaurantOwner` / `adminOrDeliveryPartner` / `resourceOwnerOrAdmin` (RBAC), `fraudDetection` (order creation only), `cacheResponse(...)` (read-heavy listing endpoints), then the controller.
10. **Terminal handlers**: `notFound` then `errorHandler`.

## Authentication (`protect`)

`backend/middleware/authMiddleware.js` resolves identity with a two-source fallback:

1. `Authorization: Bearer <jwt>` header first — the primary path for the frontend and for API clients, and the path that also unlocks the CSRF Bearer exemption.
2. `req.cookies.jwt` fallback — used by same-origin flows and by Socket.io handshake cookie parsing.

Both paths verify the token against `JWT_SECRET`, load `User.findById(decoded.userId || decoded.id).select("-password")`, and — importantly — reject the token if `decoded.tokenVersion` does not match `req.user.tokenVersion`. Password changes bump `tokenVersion`, instantly invalidating all previously issued tokens ("Token expired after password change"). No token at all yields 401 "Not authorized, no token".

`optionalAuth` runs the same resolution but never rejects; `req.user` stays `undefined` for anonymous callers. It backs public-but-personalized endpoints (e.g. chat, which conditionally exposes authenticated tools).

## Authorization (RBAC)

Roles come from the User model enum: `user`, `admin`, `restaurant_owner`, `delivery_partner`.

- `authorizeRoles(...roles)` — whitelist check, 403 with the required role list on failure; the workhorse used on routers (e.g. `authorizeRoles("admin", "restaurant_owner")` for sales stats).
- `adminOnly`, `adminOrRestaurantOwner`, `adminOrDeliveryPartner` — named convenience gates in `roleMiddleware.js`.
- `resourceOwnerOrAdmin(getResourceFn, ownerField)` — generic object-ownership check: admins pass; otherwise the resource's owner field (supports dotted paths) must equal `req.user._id`, else 403. This backs the SEC-5 style "verify order ownership" invariant outside the Socket.io layer.
- Auth middleware also re-exports its own `authorizeRoles`; routes import one or the other, behavior is identical.

## Error handling

Controllers use `express-async-handler`, so thrown errors propagate to `errorHandler` instead of crashing the process. `errorHandler` (`backend/middleware/errorMiddleware.js`):

- Preserves any status code already set on `res` (the common `res.status(x); throw new Error(...)` pattern), defaulting to 500.
- Translates MongoDB duplicate-key (code 11000) into a 400 with the field name, Mongoose `CastError` on ObjectId into 404, and `ValidationError` into a 400 with joined messages.
- Response shape is `{ message, stack }`; stack is returned only in development. Auth errors are not logged as backend errors (they are noisy, not bugs).

`notFound` 404s unmatched routes. Outside the request cycle, `server.js` crashes deliberately on `unhandledRejection` (close server, exit 1) so a supervisor restarts a clean process, and `gracefulShutdown` on SIGTERM/SIGINT closes Socket.io, then HTTP, then Mongoose, forcing exit after 10 s if hung.

## Fraud detection gate

`backend/middleware/fraudDetectionMiddleware.js` (`fraudDetection`) runs only on `POST /api/v1/orders` (see `orderRoutes.js`). It is heuristic and **non-blocking by design**: it flags high-value first orders (> ₹2000 with no history), ≥3 accounts sharing a phone prefix, and ≥3 cancellations in 7 days, logs a `FRAUD_ALERT`, attaches `req.fraudFlags`, and always calls `next()` — even on its own internal error. Blocking enforcement for order creation lives in the rate limiter and in the controller's validation, not here.

## Caching middleware

`backend/middleware/cacheMiddleware.js` exports `cacheResponse(keyPrefix, ttlSeconds)` for GET listing endpoints. It is Redis-backed through `utils/cache.js` with an in-process `Map` mutex for stampede protection (duplicate concurrent misses share one fetch), a query-hash suffix in the cache key, and graceful fallthrough to the database on any cache error. Cold-start installs without `REDIS_URL` transparently use the in-memory fallback (see the Data Model page).

## Invariants and notes

- Middleware order is load-bearing: the webhook raw-body route must precede `express.json()`; the sanitizer must not see Buffer bodies; CSRF must run before controllers that rely on the Bearer exemption.
- `X-Requested-With` is required on cookie-authenticated mutations — frontend must always send it, or requests fail with 403 "CSRF Blocked".
- Socket.io has a parallel auth path (`io.use` in `server.js`): token from `handshake.auth.token` or the `jwt` cookie, length-capped, verified against `JWT_SECRET`; unauthenticated sockets are rejected at connect time. See the Real-Time Layer page.
- Rate limits are keyed per IP (with `app.set("trust proxy", 1)` honoring the first proxy hop on Render).
