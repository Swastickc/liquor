---
type: "Reference"
title: "Real-Time Layer: Socket.io Tracking & Events"
openwiki_generated: true
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-945a9dbf41bc109f2aba8bd9
    resource: repo://backend/controllers/deliveryController.js
  - id: openwiki-source-0a2b432ee235fc41460a2149
    resource: repo://backend/controllers/productController.js
  - id: openwiki-source-61b8b4fa7a2584f170878fad
    resource: repo://backend/controllers/restaurantController.js
  - id: openwiki-source-ab975d6f2b734f6119ff4cb1
    resource: repo://backend/server.js
  - id: openwiki-source-87c7a2593f7d44ec75b15bb8
    resource: repo://frontend/src/components/order/LiveTrackingMap.jsx
  - id: openwiki-source-9fff018380cfa1c4e36a79fc
    resource: repo://frontend/src/pages/OrderDetails.jsx
  - id: openwiki-source-c7c91f63c4dd7c3d64f8799a
    resource: repo://frontend/src/pages/RestaurantMenu.jsx
  - id: openwiki-source-7c93e187d9e74a870d95fc8d
    resource: repo://frontend/src/utils/socket.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---


# Real-Time Layer: Socket.io Tracking & Events

## Where the socket lives

Socket.io is created on `backend/server.js`'s HTTP server and attached to every Express request via middleware, so any controller can `req.io.to(room).emit(...)` without importing anything (`repo://backend/server.js#L121-L142`). CORS for the socket handshake is allowlist-only (`localhost:5173`, the two production Vercel/Render URLs, plus `FRONTEND_URL`), with a deliberate SEC-7 fix removing the wildcard `.vercel.app` match; transports are `websocket` + `polling` and credentials are on (`repo://backend/server.js#L108-L136`).

## Connection authentication

An `io.use()` middleware authenticates every connection before it is accepted (`repo://backend/server.js#L144-L177`):

1. Token priority: `handshake.auth.token` first, then the `jwt` cookie parsed from the handshake headers — the cookie fallback exists because third-party cookies are unreliable on cross-origin WebSocket handshakes.
2. Missing token → next(new Error("Authentication error")) — the socket never connects anonymously.
3. Tokens longer than 1000 chars are rejected outright.
4. `jwt.verify(token, process.env.JWT_SECRET)`; the decoded payload is stored as `socket.user` (with `userId` used everywhere downstream).

Verification happens **once at connect**; per-event authorization is orthogonal (below).

## Rooms and ownership checks

On connect, each socket auto-joins its **personal room** named after `socket.user.userId` — this is how order/assignment notifications find the right user (`socket.join(socket.user.userId)`) (`repo://backend/server.js#L184-L190`). Order rooms are opt-in via the `joinOrder` event, which performs a **server-side ownership check before joining** (SEC-5): the order must exist, and the requester must be the order's `user`, the assigned `deliveryPartner`, or a privileged role (`admin` or `restaurant_owner` resolved from the DB); everyone else is silently denied (`repo://backend/server.js#L192-L214`). `leaveOrder` is unconditional. The denied path never leaks whether the order exists — the denial log is the only trace.

Because room membership is per-connection, a reconnect loses room state; consumers re-emit `joinOrder` on the socket.io-manager `reconnect` event (see LiveTrackingMap).

## Driver location tracking (FEAT-25)

The `updateLocation` event (`{ orderId, lat, lng, heading, speed }`) is the driver's position channel (`repo://backend/server.js#L221-L263`):

- **Authorization**: the order's `deliveryPartner` must equal `socket.user.userId`; anything else is rejected client-side of the write. Only the assigned driver can move the pin for their order.
- **Persistence**: `driverLocation` is written to the Order document with a **3-attempt retry loop** (200 ms between attempts); the last attempt's failure is logged but never blocks the broadcast.
- **Broadcast**: `io.to(orderId).emit("driverLocationUpdate", ...)` to the order room, **plus** a fallback emit to the order owner's personal room so a customer who never joined the room still gets the update. The emitted payload normalizes `heading`/`speed` to 0 and stamps `updatedAt`.

The stored shape matches `backend/models/orderModel.js`'s `driverLocation` field (`lat`, `lng`, `updatedAt`, `heading`, `speed`).

## Event vocabulary

Server emitters (all via `req.io` from controllers or `io` from server.js):

| Event | Room targeting | Producer | Consumer |
| --- | --- | --- | --- |
| `newOrderReceived` | restaurant owner's personal room | order creation (COD/Wallet path) + payment verification + webhook | `RestaurantOwnerDashboard` |
| `orderUpdated` | order room, customer's personal room | status changes, assignment, delivery actions, cancellation, payment | `OrderDetails`, `App.jsx` global notification handler |
| `orderAssigned` | assigned partner's personal room (carries `deliveryOTP`) | status → Ready with auto-assignment, manual assignment | `DeliveryPartnerDashboard` |
| `newDeliveryTask` | broadcast (no OTP — safe fallback when no partner assigned yet) | status → Ready without a partner | partner dashboards |
| `driverLocationUpdate` | order room + customer's personal room | `updateLocation` socket event | `LiveTrackingMap` |
| `productUpdated` | broadcast | stock decrement/restore during ordering and cancellation | shop/menu pages |
| `restaurantUpdated`, `shopStatusUpdated` | broadcast | restaurant controller updates | admin `ShopsTab`, listing pages |
| `menuReordered` | broadcast | product reordering (`productController`) | menu consumers |
| `emergencyAlert` | broadcast | driver `triggerSOS` | admin |

OTP discipline is enforced consistently at emit sites: emits to the customer or owner pass through `toObject()` + `delete ...deliveryOTP`, while the partner-facing `orderAssigned` includes it (`repo://backend/controllers/deliveryController.js#L99-L108`, `L191-L197`). One drift point worth knowing: the frontend `RestaurantMenu` subscribes to `menuItemUpdated`, and no backend emitter for that event name currently exists in the repo — stock changes reach menus via `productUpdated` (`repo://frontend/src/pages/RestaurantMenu.jsx#L148-L163`).

## Frontend socket client

`frontend/src/utils/socket.js` exposes a **module-level singleton** (`getSocket`/`disconnectSocket`) rather than per-component sockets (`repo://frontend/src/utils/socket.js#L1-L66`):

- URL resolution: localhost:5000 in dev, else `VITE_SOCKET_URL` falling back to the Render backend.
- The JWT is read from `localStorage.getItem("jwt")` and sent as `auth: { token }` — matching the server's handshake-auth priority; `withCredentials: true` additionally enables the cookie path.
- Reconnection: 5 attempts at a 2 s delay, 10 s connect timeout; on `io server disconnect` the client reconnects manually only if a token still exists (a stale-token user is cut off deliberately).
- **Token refresh handling**: every `getSocket()` compares the stored token to `socket.auth.token` and, if changed, updates the auth payload and does `disconnect().connect()` so an expired-then-renewed session doesn't fly deaf. Because it's a singleton shared across pages, components deliberately never call `disconnectSocket()` on unmount (this is documented inline in `DeliveryPartnerDashboard`).

## Consumption patterns

- `OrderDetails.jsx` joins the order room (`joinOrder(id)`) and subscribes to `orderUpdated`, filtering events by `_id` and toasting status changes (`repo://frontend/src/pages/OrderDetails.jsx#L70-L90`).
- `App.jsx` holds a global `orderUpdated` listener while the user is logged in: it fires a browser notification (`notificationHelper.sendNotification`) and plays `/notification.mp3` for any order update, independent of which page is open (`repo://frontend/src/App.jsx#L110-L135`).
- `LiveTrackingMap.jsx` (Leaflet) is the tracking surface: on mount it emits `joinOrder`, subscribes to `driverLocationUpdate`, sanitizes incoming coordinates (`Number()` + range check ±90/±180 before `setDriverPos`), re-joins on socket.io `reconnect`, and cleans up with `off` + `leaveOrder` on unmount (`repo://frontend/src/components/order/LiveTrackingMap.jsx#L31-L62`). The marker falls back to the restaurant's coordinates and a ChangeView helper pans the map on every position change.
- Dashboards and menu pages use the same subscribe-statically/off-on-cleanup shape; because rooms are server-authorized, a customer cannot observe another user's order stream.
