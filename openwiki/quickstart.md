---
type: "Reference"
title: "Quickstart: SwadKart"
openwiki_generated: true
sources:
  - id: openwiki-source-9a7277933ab0110af5cb7cbe
    resource: repo://backend/package.json
  - id: openwiki-source-ab975d6f2b734f6119ff4cb1
    resource: repo://backend/server.js
  - id: openwiki-source-1f2994ce2c818471371d726c
    resource: repo://docs/DEPLOYMENT.md
  - id: openwiki-source-1047363cf615000e4c9bb694
    resource: repo://frontend/package.json
  - id: openwiki-source-f53e7f67874f4ddd79a896b9
    resource: repo://frontend/src/config.js
  - id: openwiki-source-c1bd8bd4834d4dc70a8b85cc
    resource: repo://frontend/vite.config.js
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T12:24:36.041Z
---


# Quickstart: SwadKart

## What this repository is

SwadKart (branded "Kalna Liquor Delivery") is a **hyper-local liquor delivery platform for Kalna, West Bengal**: customers browse licensed liquor shops, order with strict compliance gating, pay online (Razorpay), by COD, or from a store-credit wallet, and track the delivery partner in real time. The defining product constraints are regulatory and show up everywhere in the code: legal ordering hours (10–22 IST), age ≥ 21 verified at registration and before order creation, single-shop checkout per order, and rider ID checks at delivery (`repo://README.md#L1-L20`).

## Stack at a glance

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React 19 + Vite 7, Redux Toolkit, Tailwind | PWA, react-leaflet maps, i18next |
| Backend | Node.js, Express 5, ESM (`"type": "module"`) | Single service, ~30 route modules |
| Database | MongoDB (Mongoose 9), geospatial indexes | Transactions for order writes |
| Cache | Redis (via a proxy that degrades to in-memory) | Rate limits, chat budget, intent cache |
| Payments | Razorpay | HMAC-verified checkout + webhook |
| Real-time | Socket.io | JWT-authenticated, ownership-checked rooms |
| AI chat | Groq SDK (llama-3.3-70b-versatile) | Orchestrated pipeline + tool calling |

Deployment shape (from `docs/DEPLOYMENT.md`): frontend on Vercel, backend on Render (which sleeps after idle), MongoDB Atlas, Redis Cloud, Cloudinary for images (`repo://docs/DEPLOYMENT.md#L5-L40`).

## Run it locally

Two processes, both from their own directory:

```bash
# Backend (default port 8000)
cd backend && npm install
npm run dev          # nodemon server.js   ─┐
# or: npm start      # node server.js       └ both: backend/package.json scripts
# Tests: npm test    # Jest via node --experimental-vm-modules
```

```bash
# Frontend (default port 5173)
cd frontend && npm install
npm run dev          # vite
npm run build        # production bundle
npm test             # Vitest property suites
```

In dev, `frontend/src/config.js` exports `BASEURL = import.meta.env.VITE_API_URL || ''` — the empty fallback means browser-relative `/api` URLs hit the **Vite dev proxy**, which forwards `/api` (with cookie-domain rewrite) and `/socket.io` (WebSocket) to `http://localhost:8000` (`repo://frontend/src/config.js#L1-L3`, `repo://frontend/vite.config.js#L110-L124`). One drift point: `frontend/src/utils/socket.js` picks `http://localhost:5000` as the dev socket URL when it isn't proxied through `VITE_SOCKET_URL` — run the backend with `PORT=5000` or set `VITE_SOCKET_URL` if you need the socket outside the proxy path (`repo://frontend/src/utils/socket.js#L3-L21`).

### Environment

`backend/server.js` validates env at boot: `JWT_SECRET` and `MONGO_URI` are always fatal-if-missing; production additionally requires `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and `COOKIE_SECRET`, enforces a ≥32-char JWT secret, and warns about test Razorpay keys (`repo://backend/server.js#L61-L90`). Full variable reference and per-service setup live in `docs/DEPLOYMENT.md`. Redis is optional in dev — every consumer (`rateLimiter`, `groqQueue`, the health check) probes and degrades to an in-memory fallback.

The frontend needs nothing mandatory to boot; in production set `VITE_API_URL` and optionally `VITE_SOCKET_URL`.

## Key entrypoints

- **`backend/server.js`** — the whole backend bootstraps here: env validation, DB connect, Express app + Socket.io server, the raw-body carve-out for the payment webhook (registered **before** `express.json`), NoSQL sanitizer, anti-CSRF middleware with a Bearer-token bypass, tiered rate limiters (`/api` general, auth 10/10 min, contact 5/h, orders 20/15 min on POST only), `/ping`, and the `/health` endpoint reporting mongo/redis connectivity (503 = degraded) (`repo://backend/server.js#L92-L107`, `repo://backend/server.js#L384-L459`).
- **`backend/routes/*`** — feature surfaces mounted at `/api/v1/...`: users (auth, profile), orders, payment, products, restaurants, inventory, analytics, payouts, notifications, image, surge, reorder, biometric, gdpr, and more. Chat routes (`/api/v1/chat`) are **currently commented out** in `server.js` in this snapshot — the chatbot code exists and is tested, but its router is dormant (`repo://backend/server.js#L464-L493`).
- **`frontend/src/`** — React Router pages (`pages/`), the Redux store slices (`redux/`, including `cartSlice`), the singleton socket client (`utils/socket.js`), and the chatbot component tree (`components/chatbot/`).
- **Health/is-it-running**: `GET /ping` → `Pong`; `GET /health` → JSON service statuses.

## Regulatory invariants you'll meet immediately

- Orders can only be created 10:00–22:00 IST and by 21+ users (`backend/utils/policy.js`).
- Carts are single-shop; adding from another shop clears the cart (`frontend/src/redux/cartSlice.js`).
- All prices are recomputed server-side at order creation; client totals are ignored (`backend/controllers/orderController.js`).

## Map of this wiki

- `architecture/overview.md` — service architecture and request topology.
- `architecture/api-gateway-middleware.md` — the middleware pipeline in `server.js` (CORS, sanitizers, CSRF, rate limiters, auth).
- `concepts/data-model.md` — Mongoose models and relationships.
- `concepts/compliance-and-security.md` — age/hour laws, sanitization, payment hardening.
- `concepts/frontend-app.md` — React app structure, state, and routing.
- `workflows/order-lifecycle.md` — cart → order → payment → delivery → payout.
- `workflows/realtime-tracking.md` — Socket.io auth, rooms, driver tracking.
- `workflows/chatbot-ai-pipeline.md` — Groq chat pipeline, tools, SSE streaming (route dormant in this snapshot).
- `testing/strategy.md` — Jest/Vitest suites, property tests, live e2e scripts, what CI actually runs.
