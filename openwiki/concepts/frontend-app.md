---
type: "Reference"
title: "Frontend PWA: State, Routing & Client Features"
openwiki_generated: true
sources:
  - id: openwiki-source-49b284af4abdb5084d5b9d09
    resource: repo://frontend/src/App.jsx
  - id: openwiki-source-f53e7f67874f4ddd79a896b9
    resource: repo://frontend/src/config.js
  - id: openwiki-source-2a0e6001b3733c644ee260e3
    resource: repo://frontend/src/i18n.js
  - id: openwiki-source-4584a3ec0244f29e2bbf2032
    resource: repo://frontend/src/redux/cartSlice.js
  - id: openwiki-source-33964d7c69ed6d48c64bdfd2
    resource: repo://frontend/src/redux/userSlice.js
  - id: openwiki-source-e8b9d03fd5b040caabb8727b
    resource: repo://frontend/src/utils/biometricService.js
  - id: openwiki-source-c1bd8bd4834d4dc70a8b85cc
    resource: repo://frontend/vite.config.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T12:24:36.041Z
---


# Frontend PWA: State, Routing & Client Features

## Structure & bootstrapping

`frontend/src/` is a Vite + React 19 SPA. `main.jsx` mounts the app with Redux `store.js`, `i18n.js`, Helmet, and toasters. `App.jsx` is the composition root: it defines all routes, the four role guards, the biometric lock layer, and the socket-driven notification wiring. Every page component is lazy-loaded (`React.lazy`) to cut the initial bundle; `ChatBot`, `Footer`, `Navbar` are also deferred.

## Routing & guards (`App.jsx`)

Route groups:

- **Public**: `/` and `/search` (Home), `/restaurant/:id` (menu), `/login`, `/register`, `/cart`, `/password/forgot`, `/password/reset/:token`, `/contact`, `/about`, `/page/:type` ( Info pages with legacy redirects).
- **PrivateRoute** (any logged-in user): `/shipping`, `/payment`, `/placeorder`, `/profile`, `/myorders`, `/order/:id`, `/subscriptions`, `/reservations`, `/group-orders`, `/privacy` (GDPR settings).
- **AdminRoute**: `/admin/dashboard`, `/admin/chatbot-analytics`.
- **RestaurantRoute**: `/restaurant/dashboard` (also `/restaurant-dashboard`).
- **DeliveryRoute**: `/delivery/dashboard` (`/delivery-dashboard` alias).
- Fallback `*` → `/`.

Guards read `state.user.userInfo` and compare `role` (`user`, `admin`, `restaurant_owner`, `delivery_partner`), redirecting to login when absent. Dashboards are `AdminDashboard.jsx`, `RestaurantOwnerDashboard.jsx`, `DeliveryPartnerDashboard.jsx` under `pages/`, each composed from tab components in `components/admin/`, `components/restaurant/`, `components/delivery/`.

## Session & state

Redux store contains only two slices — `userSlice` and `cartSlice`:

- **userSlice** holds `userInfo` (profile/status), starting from `localStorage("userInfo")`. It explicitly strips any `token` field into a separate `localStorage("jwt")` key (used by the Socket.io auth handshake, since HttpOnly cookies don't ride cross-origin WebSockets) to shrink the XSS-blast radius of `userInfo`. Async thunks: `validateSession` (on app mount, `GET /users/profile` with `credentials: 'include'`, 10 s abort; logout only on 401/403 — never on 5xx/timeouts because Render cold-starts) and `updateUserProfile`. Logout clears storage and disconnects the socket.
- **cartSlice** is the checkout source of truth: `cartItems`, `shippingAddress`, `paymentMethod` (default "Online"), all persisted to localStorage through a safe wrapper. `generateCartId` composes productId + variant name + sorted add-on names, so identical configurations merge quantities. `addToCart` enforces the **single-shop rule client-side** (blocks adding a second restaurant's item), mirroring the server-side check. It also tracks a `restaurantId` probe for coupon eligibility, and clears on order placement; logout action from userSlice resets it.

Server data for listing/pages is fetched ad hoc with axios/`fetch` against `BASEURL` (`frontend/src/config.js` = `import.meta.env.VITE_API_URL` or empty string for the dev proxy) — no RTK Query; mutations are page-level calls.

## Biometric app lock

`App.jsx` implements a standard lock screen on top of WebAuthn:

1. On mount, checks `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`, reads `localStorage("isBiometricEnabled")`, and — if supported, enabled, and the user is logged in — sets the whole app behind a lock screen.
2. The lock screen dynamically imports `utils/biometricService.js` (~5 KB deferred) which wraps `@simplewebauthn/browser` `startRegistration`/`startAuthentication` against `/api/v1/biometric` using HttpOnly-cookie auth.
3. Unlock attempts are client-limited to `MAX_ATTEMPTS = 3` before forced logout — a deliberate UX-level guard on top of the server's credential counter checks.

## PWA/service-worker behavior

Configured in `vite.config.js` (`vite-plugin-pwa`, `registerType: "autoUpdate"`): kill-switch options (`cleanupOutdatedCaches`, `skipWaiting`, `clientsClaim`) so updates activate immediately; app-shell precache of `js/css/html/ico/png/svg/xml`; `navigateFallbackDenylist` for `/api`, `/socket.io`, sitemap, robots. Runtime rules: API and Render requests are **NetworkOnly** with credentials included (never serve stale order data), socket.io is NetworkOnly, external images (Cloudinary/cartocdn/flaticon) get StaleWhileRevalidate with a 50-entry, 7-day cache. The manifest ("Kalna Liquor - Taste Delivered", standalone, portrait) drives the install flow via `components/InstallPWA.jsx`. A custom `optimizeHtml` plugin converts app CSS links into preload+noscript pairs for faster first paint.

## Real-time notifications & audio

When a user is logged in, `App.jsx` opens the shared socket (`utils/socket.js`), requests notification permission, and subscribes to `orderUpdated`: each event plays `/notification.mp3` and raises a Notification ("Order #XXXX is now ...") via `components/notificationHelper.js`. Handlers are cleaned up on unmount/user change. FCM tokens (`utils/firebaseConfig.js`, `VITE_FIREBASE_*` envs) complement this for push when the app is closed.

## Payments & invoices on the client

`pages/Payment.jsx` performs the Razorpay browser-handshake (load checkout SDK, open with `order_id` from the backend), then posts the verification triple back to the API. `utils/invoiceGenerator.js` (jsPDF + autotable) renders client-side invoices from order data; `utils/imageOptimizer.js` offloads upload compression before hitting `/api/v1/upload`.

## i18n, SEO & structured data

`i18n.js` configures i18next with browser language detection (localStorage → navigator), resources in `locales/en/common.json` and `locales/hi/common.json`, English fallback — the Hindi/English bilingual requirement. SEO is handled at two layers: `react-helmet-async` per page plus `utils/seoConstants.js`, and static `utils/structuredData.js` JSON-LD blojects; `react-helmet-async` titles/descriptions align with the PWA manifest identity.

## Failure behavior

- Zone-fenced session validation: server cold-start (5xx/timeout) preserves the session; only explicit 401/403 from `/users/profile` logs out.
- Storage access is wrapped in try/catch everywhere (private-mode safe); unreadable localStorage degrades to empty state rather than crashing the SPA.
- Socket connect failures are console-warned only — the app remains fully usable without real-time features.
