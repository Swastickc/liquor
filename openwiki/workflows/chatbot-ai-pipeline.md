---
type: workflow-pipeline
title: AI Chat Pipeline & Action Tools
description: The Groq-powered "SwadKart Genie" chat pipeline — orchestrator stages, auth-conditional tool registry, SSE streaming endpoint, rate limiting, token budgeting, escalation, and persistence for the /api/v1/chat and /api/v1/chat/stream surfaces.
tags: [chatbot, groq, llm, sse, streaming, tool-calling, rate-limiting, redis, pipeline]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-03T11:06:07.603Z
sources:
  - id: openwiki-source-8139c6288b133f2afbee39b9
    resource: repo://backend/controllers/chatController.js
  - id: openwiki-source-a23aba8d8bae77a89121dcfd
    resource: repo://backend/controllers/chatStreamController.js
  - id: openwiki-source-1d35b35bdd13d971f102e674
    resource: repo://backend/routes/chatRoutes.js
  - id: openwiki-source-fc44914c34968b4b9d3592df
    resource: repo://backend/services/chat/chatPipeline.js
  - id: openwiki-source-433cbaab1c90419cbd64a916
    resource: repo://backend/services/chat/conversationRepo.js
  - id: openwiki-source-336999ce1e79dd5e1cb2d57b
    resource: repo://backend/services/chat/groqQueue.js
  - id: openwiki-source-abe512350a06ba5091749608
    resource: repo://backend/services/chat/orderPlacementTool.js
  - id: openwiki-source-b0f9711090a8c2f0acaf88e9
    resource: repo://backend/services/chat/rateLimiter.js
  - id: openwiki-source-1ee34e90cfd275ee9fb9b603
    resource: repo://backend/services/chat/sseSerializer.js
  - id: openwiki-source-acaaf3657fc0322eb2fc0a8d
    resource: repo://backend/services/chat/tokenBudget.js
  - id: openwiki-source-116787b8305d7f0236d5c925
    resource: repo://backend/services/chat/tools/toolRegistry.js
  - id: openwiki-source-7c51f2dba1052737773977ca
    resource: repo://frontend/src/components/chatbot/hooks/useChatStream.js
generated: { by: "opencode", at: "2026-10-03T11:06:07.603Z" }
---

# AI Chat Pipeline & Action Tools

## Ownership and surfaces

The chatbot ("SwadKart Genie") lives in `backend/services/chat/` and is exposed through `backend/routes/chatRoutes.js` (mounted at `/api/v1/chat`). Two request paths share one orchestrator:

- `POST /api/v1/chat` → `chatController.chatWithGenie` — JSON one-shot reply (`emit: null`).
- `POST /api/v1/chat/stream` → `chatStreamController.streamChat` — Server-Sent Events streamed reply.

Both routes run `optionalAuth` (user id or null), the dual-tier chat rate limiter, and `multer` uploads of up to 3 attachments (5 MB each; JPEG/PNG/GIF/WebP/PDF/TXT/DOCX) (`repo://backend/routes/chatRoutes.js#L63-L79`). A separate auth-protected pair serves history (`GET /history`, `GET /history/:id`) and admin analytics (`/api/v1/admin/chatbot-analytics`, admin role).

The controllers are thin: they validate and delegate to `runChatPipeline` in `backend/services/chat/chatPipeline.js`, the single entrypoint for both modes (`repo://backend/controllers/chatController.js#L18-L58`, `repo://backend/services/chat/chatPipeline.js#L1-L19`).

## Pipeline orchestration (`chatPipeline.js`)

`runChatPipeline` wraps `executePipeline` in a `Promise.race` against a **15 s pipeline timeout** and, for SSE mode, an `AbortSignal` from the controller; on timeout, abort, or any thrown error it returns a degraded fallback reply (see "Failure behavior") (`repo://backend/services/chat/chatPipeline.js#L262-L363`). The inner steps (`repo://backend/services/chat/chatPipeline.js#L378-L634`):

1. **Load history** — `conversationRepo.loadRecentMessages(sessionId)` (capped, 24 h freshness).
2. **Detect language** — synchronous, pure `detectLanguage(message)` from `languageDetector.js` (English, Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi via Unicode script ranges + Hinglish keyword scoring) (`repo://backend/services/chat/languageDetector.js#L10-L45`).
3. **Intent + sentiment in parallel** — `Promise.all` of `classifyIntent` and `analyzeSentiment` (`repo://backend/services/chat/chatPipeline.js#L385-L388`).
4. **Conditional retrieval** — products are fetched only for `recommendation`, `order_inquiry`, or `order_placement` intents; retrieval failures degrade to an empty list, never throw (`repo://backend/services/chat/chatPipeline.js#L67-L67`, `L391-L398`).
5. **System prompt + token budget** — `buildSystemPrompt` embeds the language instruction ("respond ONLY in ${language}"), sanitized product lines (name ≤ 100 chars, description ≤ 200 chars, control chars stripped), and the user's current cart; `fitToBudget` fits it all under a 6000-token budget using tiktoken cl100k_base (which over-counts vs Llama, a deliberate safety margin), always keeping system + new user message and truncating history newest-first (`repo://backend/services/chat/chatPipeline.js#L85-L117`, `repo://backend/services/chat/tokenBudget.js#L21-L60`).
6. **Tool registry** — `buildToolRegistry({ userId })` (below).
7. **LLM call with retry + multi-tool loop** (below).
8. **Stream events** — the full reply is emitted as one `token` event followed by a `done` event (Groq responses are not token-streamed; the SSE layer streams per-event, not per-token).
9. **Persist** — user + assistant messages appended via `conversationRepo.appendMessages`; conversation's `language` and `lastResponseMs` updated; the assistant message id returned. Persistence failure is swallowed — the user still gets the reply (`repo://backend/services/chat/chatPipeline.js#L574-L620`).
10. **Escalation check** — `checkEscalation` sets a **sticky** `escalationFlag` on the Conversation document when the last 3 user-message sentiments (history + current) are all `< -0.4`; it never clears the flag and swallows its own errors (`repo://backend/services/chat/chatPipeline.js#L204-L248`).

The model is `llama-3.3-70b-versatile`, temperature 0.7, `max_tokens: 400`, with `tools`/`tool_choice: "auto"` only when the registry is non-empty (`repo://backend/services/chat/chatPipeline.js#L145-L161`).

### Retry policy and the Groq queue

`callGroqWithRetry` allows **3 attempts total** with 500 ms / 1500 ms backoff. HTTP 429 and a queue-fallback result (`{ fallback: true }` from `callGroq`) abort retries immediately (`repo://backend/services/chat/chatPipeline.js#L142-L192`).

All Groq traffic funnels through `groqQueue.callGroq(fn)`, a free-tier budget manager that caps calls at **27 per calendar minute** (3-call margin under Groq's 30 rpm limit) using a Redis counter `chat:groq:rpm:<YYYYMMDDHHmm>` (TTL 90 s). Over-budget calls enqueue into a Redis FIFO (`chat:groq:queue`, cap 100) with a **10 s deadline**; a deadline hit resolves `{ fallback: true, reason: "deadline_exceeded" }`, and a full queue throws `groq_queue_full`. When Redis is unavailable an equivalent in-memory minute counter + queue is used (`repo://backend/services/chat/groqQueue.js#L1-L28`, `repo://backend/services/chat/groqQueue.js#L254-L336`).

Sub-analyzers are themselves cache-first and timeout-guarded: `classifyIntent` hashes the normalized message (SHA-256) into `chat:intent:<hash>`, tries Redis with a 200 ms timeout, else calls Groq with `max_tokens: 10` and a 2 s timeout, validating output against `INTENT_SET` and caching hits for 3600 s; `analyzeSentiment` calls Groq with a 3 s timeout and clamps to [-1, 1], returning 0.0 on any failure (`repo://backend/services/chat/intentClassifier.js#L17-L76`, `repo://backend/services/chat/sentimentAnalyzer.js#L25-L70`).

### Multi-tool loop

After the first completion, if it contains `tool_calls`, the pipeline loops (max **5 iterations**): it appends the assistant tool-call message, executes each call via `getToolExecutor(name)` with parsed JSON args plus `userId` (unknown tool → `{ success: false, reason: "unknown_tool" }`, executor throw → `internal_error`), appends `role: "tool"` messages with stringified results, emits a `tool_call` SSE event per call, and re-calls the LLM with the accumulated messages until a final text reply emerges (`repo://backend/services/chat/chatPipeline.js#L479-L543`).

## Auth-conditional tool registry

`backend/services/chat/tools/toolRegistry.js` is the single place tool availability is defined:

- `PUBLIC_TOOLS`: `faq_support` — always available, even for anonymous users.
- `AUTH_TOOLS`: `place_order`, `get_order_status`, `cancel_order`, `get_delivery_eta`, `reorder_last` — included only when `userId` is truthy (`repo://backend/services/chat/tools/toolRegistry.js#L28-L41`).
- `buildToolRegistry({ userId })` returns Groq-compatible schemas; `getToolExecutor(name)` maps names to executors (from a prebuilt Map) and returns `null` for anything unregistered — the coupon tool is commented out at the import site (`repo://backend/services/chat/tools/toolRegistry.js#L17-L89`).

`place_order` (`backend/services/chat/orderPlacementTool.js`) is the write-path tool: it gates sequentially on (1) truthy `userId`, (2) product existence, (3) integer quantity 1–10, (4) stock availability (`stock >= quantity` and `isAvailable`), then (5) writes to the User model's shared `cartItems` array — the same cart the frontend uses (`repo://backend/services/chat/orderPlacementTool.js#L1-L55`). The other tools are read-only order lookups, cancellation, delivery ETA, FAQ, and last-order reorder, each with its own `toolSchema` + `execute` pair under `backend/services/chat/tools/`.

## Rate limiting (dual-tier, fail-open)

`backend/services/chat/rateLimiter.js` enforces two fixed windows: **IP tier 10 requests / 60 s** and **user tier 50 requests / 3600 s** (user tier only when authenticated). Redis availability is probed per request with a 200 ms `PING` timeout and verification that `incr`/`expire`/`ttl` exist as real functions (the shared cacheClient proxies to in-memory when Redis isn't ready — the probe distinguishes the two). Each tier's counter is `INCR` + `EXPIRE` on first hit; any Redis error mid-request falls back to an in-memory Map increment for that key (`repo://backend/services/chat/rateLimiter.js#L1-L56`, `L110-L154`).

The Express wrapper in `chatRoutes.js` converts a violated tier into `429 { error: "rate_limited", retryAfterSeconds }` and, notably, **fails open**: if the limiter itself throws, the request proceeds (`repo://backend/routes/chatRoutes.js#L38-L57`).

## SSE streaming endpoint

`streamChat` validates `message` (non-empty, ≤ 2000 chars) and `sessionId`, then writes SSE headers (`text/event-stream`, `no-cache`, `keep-alive`, `X-Accel-Buffering: no` for nginx) (`repo://backend/controllers/chatStreamController.js#L18-L58`). It maintains:

- An **inactivity timer**: 30 s with no emitted event → write an `error` event ("Stream timeout") and end the response; every emission resets it.
- **Disconnect detection**: `req.on("close")` sets `clientDisconnected`, aborts the pipeline via `AbortController`, and clears the timer (`repo://backend/controllers/chatStreamController.js#L60-L108`).
- An `emit` callback that is a no-op once the client is gone, passed into the pipeline so `token`, `tool_call`, `done`, and `error` events reach the wire.

Event framing is owned by `sseSerializer.js`: events must have an id (1–64 chars), a type from `{ token, tool_call, done, error }`, and a non-null object payload ≤ 65536 bytes; `serializeEvent` produces `data: {...}\n\n` and `parseEventLine` is the mirror-image parser used by the frontend (`repo://backend/services/chat/sseSerializer.js#L1-L98`). The frontend consumes the stream with `fetch` + `ReadableStream` (POST-based SSE, `credentials: "include"`) in `frontend/src/components/chatbot/hooks/useChatStream.js`, parsing lines with the shared `parseEventLine` and accumulating `streamedText` / `toolCallResult` / `error` state (`repo://frontend/src/components/chatbot/hooks/useChatStream.js#L1-L67`).

## Fallbacks and failure behavior

`fallbackResponder.js` holds static, language-aware degraded replies (≤ ~500 chars) for all seven supported languages, pointing users to `/menu`, `/cart`, and support email; `buildFallback(language)` falls back to English for unknown languages and always returns `degraded: true` (`repo://backend/services/chat/fallbackResponder.js#L10-L58`). Degradation can surface from:

- The outer 15 s timeout or client abort in `runChatPipeline` — fallback language is re-detected, the user message is best-effort persisted, an `error` event is emitted in stream mode, and the result is `{ degraded: true, intent: "unknown", sentiment: 0.0 }` (`repo://backend/services/chat/chatPipeline.js#L306-L356`).
- All Groq attempts failing or a 429 inside `executePipeline` — same degraded shape, but with the already-computed `intent`/`sentiment`, and escalation is still checked even on the fallback path (`repo://backend/services/chat/chatPipeline.js#L419-L477`).
- A tool-loop LLM re-call failure — breaks the loop with a fallback reply rather than failing the whole request.

Design invariant: user-facing failures never throw to Express; every catch in the pipeline either degrades gracefully or swallows persistence/emit errors, so the HTTP layer's 500 (in the JSON controller) is only reachable for truly unexpected bugs.

## Persistence and state

- **Conversation documents** (`Conversation` model): embedded `messages` array, `escalationFlag`, `language`, `lastResponseMs`, keyed by `sessionId`. `conversationRepo.appendMessages` appends atomically with `$push` + `$each` + `$slice: -200` (max 200 messages retained), upserts on `sessionId`, sets `userId` when provided, and retries twice with 200 ms/400 ms backoff before throwing (`repo://backend/services/chat/conversationRepo.js#L1-L76`).
- **Redis** (`backend/config/redis.js`): rate-limit counters, intent cache, Groq RPM counter and queue — every use is timeout-guarded with an in-memory degradation path.
- **Cart writes** from `place_order` go to the User model, not the conversation.
- `backend/services/chat/cleanupJob.js` runs scheduled cleanup of old conversations (exposes `_internals`-style test seams).

## Extension seams

- New tool: add `toolSchema` + `execute` under `backend/services/chat/tools/`, register it in `PUBLIC_TOOLS` or `AUTH_TOOLS` — no pipeline changes needed (the loop is registry-driven). Cover it with a `tests/unit/<tool>Tool.test.js` and registry assertions.
- New intent label: extend `INTENT_SET` and `RETRIEVAL_INTENTS` if it should trigger product retrieval.
- New language: extend `SUPPORTED` + script detection in `languageDetector.js` and the `STATIC` fallback table in `fallbackResponder.js`.
- New SSE event type: update `VALID_TYPES` in `sseSerializer.js` and both the emitting and consuming sides (`chatPipeline` / frontend `useChatStream`).
