---
type: overview
title: System Architecture Overview
description: End-to-end layout of the SwadKart liquor delivery system — React PWA frontend, Node/Express + Socket.io backend, MongoDB and Redis layers, external service integrations, and the Vercel/Render deployment topology.
tags: [architecture, overview, deployment, pwa, express, socket-io, mongodb]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-7638a45ddca1b49c5e341de2
    resource: repo://backend/config/db.js
  - id: openwiki-source-c07db992cb4de5c4d4802359
    resource: repo://backend/config/redis.js
  - id: openwiki-source-ab975d6f2b734f6119ff4cb1
    resource: repo://backend/server.js
  - id: openwiki-source-33964d7c69ed6d48c64bdfd2
    resource: repo://frontend/src/redux/userSlice.js
  - id: openwiki-source-c1bd8bd4834d4dc70a8b85cc
    resource: repo://frontend/vite.config.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---

# System Architecture Overview

SwadKart (branded "Kalna Liquor Delivery") is a hyper-local liquor delivery platform for Kalna, West Bengal. It is a two-app monorepo: a React PWA in `frontend/` and a Node.js API server in `backend/`. The distinguishing domain constraints — legal drinking-age gating, state-mandated ordering hours, and single-shop checkout — are enforced server-side (see Liquor Compliance page), while payment, real-time tracking, and media are delegated to external services.

## Layers

```
Browser (PWA, React 19 + Redux Toolkit)
        │  REST /api/v1  +  Socket.io WebSocket
        ▼
Express 5 API server (backend/server.js, port 8000)
  ├── middleware pipeline (CORS/CSRF/sanitize/limiter/auth — see gateway page)
  ├── ~30 controllers under backend/controllers/
  ├── Socket.io attached to the same HTTP server (req.io injected per request)
  └── services/chat (Groq AI pipeline)
        ▼
MongoDB via Mongoose (backend/config/db.js) ── Redis cache (backend/config/redis.js)
        ▼
External services: Razorpay (payments), Cloudinary (images),
Firebase (FCM push), Brevo/SMTP (email), Groq (AI chat)
```

## Frontend

`frontend/` is a Vite 7 + React 19 single-page PWA (`vite-plugin-pwa` with Workbox). State is Redux Toolkit (`frontend/src/redux/`: `userSlice`, `cartSlice`, `store.js`) with localStorage persistence; routing is React Router v7 with role-based route guards (`PrivateRoute`, `AdminRoute`, `RestaurantRoute`, `DeliveryRoute` in `App.jsx`). Real-time client code is centralized in `frontend/src/utils/socket.js`. `vite.config.js` proxies `/api` to `http://localhost:8000` in dev and configures the service worker so that **API and Socket.io traffic is always NetworkOnly** (never cached), while app shell assets are precached and external images (Cloudinary, basemaps) use StaleWhileRevalidate. The manifest identifies the app as "Kalna Liquor - Taste Delivered" in standalone display mode.

## Backend process model

`backend/server.js` is the whole runtime:

1. `validateEnv()` — fails fast on missing production secrets (see gateway page).
2. `connectDB()` — Mongoose connection with production-tuned pool sizing (maxPoolSize 50 in prod vs 10 in dev, `writeConcern: majority`), 5 connection retries with doubled backoff, and `process.exit(1)` if all retries fail (`backend/config/db.js`).
3. Express app + `httpServer` + Socket.io `io` sharing one port (`PORT` or 8000). `io` is attached to every request as `req.io` so controllers can emit events.
4. Middleware stack, rate limiters, ~20 route modules mounted under `/api/v1/*` (users, orders, payment, products, restaurants, biometric, inventory, analytics, payouts, notifications, image, surge, reorder, analytics/inventory forecasts, GDPR; listings like chat routes are currently commented out in the mount table).
5. Static serving: `/uploads` (local image uploads, 7-day immutable cache) and `/` public assets; JSON index at `/` and health checks at `/ping` and `/health` (the latter reports Mongo + Redis readiness with 200/503).
6. Graceful shutdown on SIGTERM/SIGINT (Socket.io → HTTP → Mongoose, force-exit after 10 s) and deliberate crash on `unhandledRejection`.

## Data & cache layer

MongoDB Atlas is the only durable store. Mongoose models live in `backend/models/` (13 models: User, Order, Product, Restaurant plus supporting Conversation, Notification, Emergency, Payout, Reservation, etc.). Restaurant locations and delivery-partner positions use GeoJSON with a `2dsphere` index. **Redis is optional and degradeable**: `backend/config/redis.js` returns a real Redis client when `REDIS_URL` is set, otherwise an in-memory LRU-capped (`1000` entries) Map client with the same get/setEx/del/ping surface — the app runs without Redis in dev and survives Redis outages as degraded cache. Read caching goes through `utils/cache.js` / `cacheMiddleware`.

## External services

| Service | Used for | Integration point |
|---|---|---|
| Razorpay | Online payment | `paymentController` (create order, HMAC verify, webhook); raw-body route in server.js |
| Cloudinary | Product/media CDN | `config/cloudinary.js`, Multer + `multer-storage-cloudinary`, `sharp` processing |
| Firebase Admin | FCM push notifications | `utils/pushNotification.js`; browser side `utils/firebaseConfig.js` |
| Brevo / Nodemailer | Transactional email | `utils/sendEmail.js`, `utils/emailTemplates.js` |
| Groq SDK | AI chat + recommendations | `services/chat/` pipeline (see AI Chat page) |
| Google OAuth | Sign-in option | `@react-oauth/google` on frontend, Godogle-check endpoints backend |

## Deployment topology

- **Frontend → Vercel**: `swadkart.vercel.app`, auto-deploy on main; `frontend/vercel.json` holds build config; `VITE_API_URL` set in Vercel env.
- **Backend → Render**: `swadkart-backend.onrender.com`; the free tier cold-starts in 30–50 s, which is why the frontend's session-validation thunk only logs out on explicit 401/403, never on 5xx/timeouts.
- **MongoDB Atlas** replica set, **Redis Cloud** optional, Cloudinary/ Razorpay managed SaaS.
- CORS allows exactly the Vercel frontend origin and the Render origin (gateway page), Socket.io applies the same whitelist.

## Invariants / boundaries

- The frontend never computes order money amounts: server-side recalculation is authoritative (see Order Lifecycle page).
- Payments and push/email are side effects wrapped in non-blocking try/catch — notification failures never fail the order transaction.
- Real-time and REST share the same process and the same JWT secret; sockets authenticate at connect, rooms are ownership-checked (see Real-Time page).
- Disabled-but-present modules (chat routes mount, coupon models used via commented imports, loyalty/referral/group-order/subscriptions) read as commented-out `server.js` imports — the code exists but is not mounted at `/api/v1/*`, so those endpoints are currently unreachable from the mounted API.
