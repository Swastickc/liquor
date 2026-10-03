---
type: testing-strategy
title: Testing & Verification Strategy
description: How SwadKart verifies behavior — backend Jest suites (supertest API tests on MongoMemoryServer, fast-check property tests, unit and integration tests), frontend Vitest property tests, standalone live e2e scripts, and what CI actually runs.
tags: [testing, jest, vitest, fast-check, property-testing, e2e, supertest, puppeteer, ci]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-164e2da859b5277df81c7d94
    resource: repo://.github/workflows/ci.yml
  - id: openwiki-source-2fc1b8e5473bb458803b2e5b
    resource: repo://backend/api_e2e_test.js
  - id: openwiki-source-79e00c0bcb67de7436722f1d
    resource: repo://backend/jest.config.js
  - id: openwiki-source-9a7277933ab0110af5cb7cbe
    resource: repo://backend/package.json
  - id: openwiki-source-c792b2ac1bc5697202250b97
    resource: repo://backend/tests/api.test.js
  - id: openwiki-source-154adf51ccfc387138a824b0
    resource: repo://backend/tests/generators/chat.js
  - id: openwiki-source-1e0bd60cc69e94ccb4b8707c
    resource: repo://backend/tests/properties/chatPipeline.property.test.js
  - id: openwiki-source-b6db131a7d81041f07424b63
    resource: repo://e2e_live_test.mjs
  - id: openwiki-source-6bac09add3cbc95ba049fea3
    resource: repo://frontend/src/__tests__/properties/useChatSession.property.test.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---

# Testing & Verification Strategy

## Ownership and layout

SwadKart has two real test suites plus two standalone e2e scripts that are deliberately kept out of the suites:

| Layer | Runner | Location | Purpose |
| --- | --- | --- | --- |
| Backend (API, chatbot, tools) | Jest 29 (ESM) | `backend/tests/` | Integration + property + unit coverage of the Express app and chat pipeline |
| Frontend (React hooks/logic) | Vitest 4 | `frontend/src/__tests__/` | Property tests over extracted pure logic |
| API e2e (live deployment) | plain Node | `backend/api_e2e_test.js` | Walks the live Render API through login → order → Razorpay verify |
| UI e2e (live deployment) | Puppeteer | `e2e_live_test.mjs` | Drives the live Vercel frontend through a full purchase flow |

Run commands (from `backend/` and `frontend/` respectively):

- Backend: `npm test` → `node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit` (`repo://backend/package.json#L8-L10`). The `--experimental-vm-modules` flag is mandatory because the backend is `"type": "module"` and Jest needs ESM VM support for the `unstable_mockModule` pattern used throughout.
- Frontend: `npm test` → `vitest run`; `npm run test:watch` for watch mode (`repo://frontend/package.json#L11-L12`).
- E2E scripts: `node backend/api_e2e_test.js` and `node e2e_live_test.mjs` (root of the repo). They hit production URLs and are never wired into any test runner.

## Backend Jest configuration

`backend/jest.config.js` sets `testEnvironment: "node"`, `testMatch: ["**/tests/**/*.test.js"]`, a 30 s per-test timeout, verbose output, and `coverage` as the coverage directory (`repo://backend/jest.config.js#L1-L8`). Anything under `backend/tests/` ending in `.test.js` is picked up automatically — there is no per-directory registration.

### Directory taxonomy under `backend/tests/`

- `api.test.js` — full-app HTTP integration tests (see below).
- `integration/chatbot.integration.test.js` — the chat pipeline end-to-end with all external I/O (Groq, Redis, MongoDB) mocked; validates SSE streaming, rate limiting, and order placement over the orchestrator (`repo://backend/tests/integration/chatbot.integration.test.js#L1-L9`).
- `properties/*.property.test.js` — 13 fast-check property suites, one per chat subsystem (chatPipeline, streaming, analytics, conversationRepo, fallbackResponder, intentClassifier, languageDetector, orderPlacement, rateLimiter, retrievalService, sentimentAnalyzer, sseSerializer, tokenBudget). These are the largest and most demanding suites; `chatPipeline.property.test.js` alone is ~770 lines.
- `unit/` — deterministic unit tests: `toolRegistry.test.js` plus one test file per tool (`deliveryEtaTool`, `faqTool`, `orderCancelTool`, `orderStatusTool`, `reorderTool`).
- `retrievalService.test.js` — a unit-style suite sitting directly at the tests root (formatting helpers + retrieval logic with a mocked Product model).
- `generators/chat.js` — shared fast-check generators (see "Generators" below).

### API integration tests: real app, ephemeral Mongo

`backend/tests/api.test.js` imports the real Express app. In `beforeAll` it spins up `MongoMemoryServer`, points `process.env.MONGO_URI` at it, sets `PORT = 0` (ephemeral port), then dynamically imports `../server.js` and waits (up to 10 s) for `mongoose.connection` to reach `connected` (`repo://backend/tests/api.test.js#L15-L41`). `afterAll` closes the mongoose connection and stops the in-memory server. All requests go through `supertest(app)` directly — no network listener is involved.

What the suite actually asserts:

- Health endpoints: `GET /health` may return 200 or 503 (degraded) but must report both `services.mongo` and `services.redis`; `GET /ping` returns plain `Pong`; `GET /` returns the `SwadKart API` service descriptor (`repo://backend/tests/api.test.js#L45-L66`).
- Route contracts with a tolerant style: list endpoints must be either a plain array or a paginated envelope, invalid `page`/`limit` query values must not 500, and an invalid product ID may 400/404/500 — the test accepts the union rather than pinning one status.
- Removal contract: routes for features that were deleted (`/swadpass/status`, `/coupons/validate`, `/cost-calculator/batch`, `/delivery-calculator/fee`, `/driver-earnings/calculate`) must return 404 (or 403/404 for the calculator pair) (`repo://backend/tests/api.test.js#L133-L169`). This keeps dead features from silently reappearing.
- Security invariants: `$`-operator and dotted-key payloads sent to the login route must be sanitized so the request cannot crash the handler (asserted as "status must not be 500"), and repeated `GET /ping` under the test limiter must stay 200 (`repo://backend/tests/api.test.js#L171-L203`).

Note the CSRF-style headers: several requests set `Origin: http://localhost:5173` and `X-Requested-With: XMLHttpRequest` because the real middleware rejects cross-origin or non-AJAX writes. New tests that POST/PUT must replicate both headers.

### Property tests and ESM mocking

The chat property suites use `jest.unstable_mockModule("<module>", factory)` to replace every I/O dependency (groq client, `groqQueue`, `conversationRepo`, `tokenBudget`, `toolRegistry`, `fallbackResponder`, `sseSerializer`, `retrievalService`, classifiers) before dynamically importing the module under test (`repo://backend/tests/properties/chatPipeline.property.test.js#L20-L120`). Suites then use `fc.assert(fc.property(...), { numRuns: 50–100 })` to prove invariants rather than example-based assertions, e.g.:

- Pipeline performs intent classification and sentiment scoring before the assistant reply (tracked via a `callOrder` array).
- Escalation flag turns on after exactly three consecutive negative messages and is sticky.
- At most three Groq calls per user message; retry policy caps at three attempts with backoff.
- The pipeline still returns a successful response under arbitrary Redis failure modes.

The same mock-then-import pattern backs the unit tests, e.g. `backend/tests/unit/toolRegistry.test.js` mocks `orderPlacementTool` (avoiding a mongoose dependency) before importing `toolRegistry.js`, then verifies the registry exposes only `faq_support` for unauthenticated users and all 6 tools for authenticated ones, and that executors resolve for known names and `null` for removed or unknown ones (`repo://backend/tests/unit/toolRegistry.test.js#L10-L94`).

### Shared generators

`backend/tests/generators/chat.js` builds `arbMessage` from structured fast-check arbitraries mixing Latin words, Hinglish keywords (`yaar`, `bhai`, `bindaas`, …), and codepoint pools for Devanagari, Tamil, Telugu, and Bengali scripts (`repo://backend/tests/generators/chat.js#L1-L49`). This is deliberate: the chatbot's language detection, sentiment, and fallback behavior are exercised against the multilingual input the product actually receives. The frontend mirrors this with `frontend/src/__tests__/generators/chat.js`.

## Frontend Vitest property tests

The frontend has no component-rendering tests; all six suites under `frontend/src/__tests__/properties/` (`pastConversations`, `quickActionChips`, `streamingWidget`, `useChatSession`, `useResponsiveWidget`, `voiceControls`) test pure functions extracted from hooks or modules, keeping Vitest free of any DOM/JSX toolchain.

The canonical pattern is `useChatSession.property.test.js`: it re-implements the hook's pure logic locally as `createSessionManager(storage)` with a `Map` standing in for `localStorage` (key `swadkart_chat_session_id`), then uses fast-check to prove that `resolveSessionId` always yields a UUID v4, persists exactly when the stored value is missing or invalid, returns the stored value unchanged when valid, and that `startNewChat` produces a fresh unique persisted UUID every time (`repo://frontend/src/__tests__/properties/useChatSession.property.test.js#L16-L53` and the `fc.assert` blocks at lines 55–171). Tests run with plain `crypto.randomUUID()`; there is no jsdom environment to configure.

## Standalone live e2e scripts

These scripts are run by hand against the deployed stack and are intentionally not part of Jest or Vitest.

### `backend/api_e2e_test.js` — API-level purchase flow

A single axios-driven script against `https://kalna-liquor-backend.onrender.com` (`repo://backend/api_e2e_test.js#L1-L7`):

1. Log in a seeded customer (`customer@kalna.com`), capture the `set-cookie` JWT and any body token.
2. `GET /api/v1/users/restaurants`, pick the first shop; `GET /api/v1/products/restaurant/:shopId`, pick the first product.
3. `POST /api/v1/orders` with cart-shaped `orderItems` (denormalized `name`/`price`/`image` plus `product`/`restaurant` refs) and a full `shippingAddress`.
4. `POST /api/v1/payment/create` with the DB order id to get a Razorpay order id and amount.
5. Simulate a successful payment locally: fabricate a payment id and compute the HMAC-SHA256 of `razorpay_order_id|razorpay_payment_id` with the Razorpay secret (`repo://backend/api_e2e_test.js#L95-L109`).
6. `POST /api/v1/payment/verify` with the forged-but-correct signature and assert `success: true` — proving the backend's signature verification and order-marking logic end to end.

It logs progress with emoji-prefixed messages and prints `err.response.data` on failure; nothing here uses a test framework, so a nonzero exit is not guaranteed — read the console output.

### `e2e_live_test.mjs` — Puppeteer UI flow

Headless Puppeteer against `https://liquor-chi.vercel.app` (`repo://e2e_live_test.mjs#L1-L14`): clicks the "Kalna Premium Liquors" shop card, clicks an `ADD` button, goes to `/cart`, clicks checkout, switches to the Register tab, and registers a brand-new user with a timestamped email, password `password123`, and date of birth `1990-01-01` — chosen deliberately so the server's 21+ age gate passes (`repo://e2e_live_test.mjs#L53-L83`). It then fills the shipping form, selects the Online/Razorpay payment method, places the order, and waits for the Razorpay modal: the assertion is simply whether a cross-origin iframe whose URL contains `razorpay.com` appears, because Razorpay's bot protection makes it impossible to fill card details inside the iframe (`repo://e2e_live_test.mjs#L126-L141`). On any failure it screenshots to `error.png` at the repo root before closing the browser — that file's presence is the failure signal.

## CI: what actually runs in automation

`.github/workflows/ci.yml` (push to `main`/`develop`, PRs to `main`) runs three jobs, none of which execute the Jest/Vitest suites (`repo://.github/workflows/ci.yml#L1-L11`):

1. `backend-check` — `npm ci`, then `node --check` over every backend `.js` file (syntax gate only).
2. `frontend-lint` — `npm run lint` (ESLint).
3. `frontend-build` — `npm run build` (production bundle compiles).

Consequence: the entire property and integration corpus runs only when a developer invokes `npm test` locally or in `backend/`. The fast suites rely on MongoMemoryServer downloads on first use, and the 30 s Jest timeout accommodates slow chat-pipeline property runs. If you change chat behavior, the honest verification gate is a local `cd backend && npm test` run — CI will not catch a broken property suite.

## Invariants and failure behavior worth preserving

- Tests never talk to a real Mongo except through MongoMemoryServer; chatbot suites never talk to real Groq or Redis (mocked at the module boundary).
- Property suites assert cross-cutting invariants (call ordering, bounded retries, degradation under Redis failure) rather than specific strings, so they survive prompt/copy changes.
- The "removed routes must stay removed" block in `api.test.js` acts as a regression tripwire for feature deletions.
- The live e2e scripts depend on seeded production data (`customer@kalna.com`, "Kalna Premium Liquors", a product existing in shop 1) and on real Razorpay/Render/Vercel availability; they are smoke checks, not hermetic tests.

## Extension seams

- New chat subsystem → add a `backend/tests/<area>.property.test.js` using `jest.unstable_mockModule` for its I/O deps and, if input-shaped, extend `backend/tests/generators/chat.js` first.
- New tool → mirror the five existing `tests/unit/*Tool.test.js` files plus registry assertions in `toolRegistry.test.js`.
- New HTTP route → extend `api.test.js`, remembering the `Origin` + `X-Requested-With` headers for state-changing requests.
- New frontend hook logic → extract pure functions, then add a Vitest property suite under `src/__tests__/properties/` following the `createSessionManager` style (Map-based storage, `fc.assert` with explicit `numRuns`).
