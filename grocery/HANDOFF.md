# Saved checkpoint — 17 September 2026

## User direction
Continue the existing grocery product, use existing MongoDB/Render services, leave alcohol pages unchanged. Mobile PWA, admin controls, driver workflow and Razorpay test-mode end-to-end verification are required. Do not resume Supabase setup. Push completed checkpoints regularly; user explicitly requested this.

## Saved source
- Repository: https://github.com/Swastickc/liquor
- Implementation commit: 7467b6ec236a7273d556e558e30c7d23ef7129b3 (confirmed on origin/main).
- Frontend: grocery/ in the repository; local deliverable outputs/grocery-storefront/.
- Backend: backend/grocery/ mounted from backend/server.js.
- Backend integration tests: backend/tests/grocery.test.js.
- Local checkout: /Users/peter/Documents/Codex/2026-09-17/new-chat/work/liquor.

## Implemented
CollectUI-inspired grocery storefront with React Bits components; search/categories/sorting, product details and persistent bag. Product/photo/stock editor, store hours and manual closure, delivery pincodes, minimum order and delivery fee. Email OTP session interface, customer orders, driver enrolment and admin approval, assignment and delivery confirmation code. Separate grocery Mongo collections, transactional reservations, expiry/release, payment verification and webhook. Grocery sessions use a separate signing key derived from existing JWT_SECRET; existing admin email roles are reused. PWA manifest/icons and offline fallback. Error boundary and optimistic stock update checks.

## Verified
- Frontend production build passed.
- 10 frontend/utility/PWA tests passed.
- 6 integration tests passed against a real temporary Mongo replica set: concurrent reservations, expiry/payment replay, delivery codes, OTP/auth boundaries, admin updates and payment/webhook validation with mocked external services.
- Original Render /health returned HTTP 200 and Mongo connected.
- Initial Vercel grocery deployment succeeded at https://kalna-daily.vercel.app (project peter-5cb3/kalna-daily).
- Hosted preview renders, search/filter/sort/product detail work, browser console had no errors. Local bag persisted across reload and removal worked. Earlier local admin photo upload/add/hide/store closure tests passed.

## Deployment state — NOT launch complete
The published Vercel version is the earlier design preview, not the latest Mongo integration. Latest code is pushed to main. Render deployment after that push has NOT yet been checked. Do not claim full deployment/integration or successful test payment.
Existing backend: https://kalna-liquor-backend.onrender.com; Render service srv-dajfi667bikc73bsr24g, project prj-dajfi60ae00c739pfke0. Render builds main from this repository. Last observed deployed commit before our push was c393002. Existing Vercel liquor project points VITE_API_URL to that backend; old frontend proxy also contains a stale upstream SwadKart URL (not changed).

## Next steps
1. Inspect Render deploy/logs for 7467b6e and verify /api/grocery/health. Its read-only test-key check calls Razorpay only when key ID starts rzp_test_. Inspect returned mode/configuration flags; no real test-card checkout has happened.
2. Email is blocked: Render environment listed Mongo, JWT, Cloudinary, Razorpay and frontend config but no Brevo/SMTP variables. User was asked to configure BREVO_API_KEY plus a verified SMTP_FROM_EMAIL, or SMTP_HOST/PORT/MAIL/PASSWORD. No answer yet. Never put secrets in chat or git.
3. Once backend is healthy, set VITE_GROCERY_API=/api/grocery in kalna-daily Vercel project and redeploy latest grocery directory. Its vercel.json proxies /api/grocery to existing Render. No new database required. Supabase creation stopped at terms consent; no Supabase installation exists.
4. Test hosted email OTP and admin sign-in using the owner's existing admin email, photo uploads, store settings, product CRUD, driver enrolment/approval, order lifecycle and access boundaries. Hosted grocery catalog starts empty; add actual business inventory or clearly isolated test products, not mock stock as real stock.
5. Razorpay: verify test mode and keys; configure payment.captured webhook /api/grocery/webhook and matching GROCERY_RAZORPAY_WEBHOOK_SECRET. Set GROCERY_CHECKOUT_ENABLED=true only for controlled test verification with test keys, then perform browser test-card success/failure/duplicate callback/webhook tests. Keep real ordering closed until ready.
6. Test phone sizes and PWA install/offline behavior on final hosted version. Reset temporary browser viewport overrides after testing.
7. Consider linking new Vercel project to GitHub with root directory grocery for future automatic deployments (not configured yet).

## Known remaining product gaps
Automated refunds/cancellations, GPS tracking, SMS sign-in OTP and push notifications are not implemented. Late captured payments are flagged payment_review for staff action through Razorpay. Real catalogue, business contact details, delivery/refund/privacy policies and production payment settings are still needed. Render Free sleeps and can delay initial requests 50+ seconds; stock expiry interval pauses while asleep. No paid upgrade was made.

## Local sessions and access
Vercel CLI is authenticated. User signed into Render in the in-app browser. Browser runtime was reset once after app crash; re-bootstrap only if bindings no longer exist. Follow browser skill. No secrets copied into source. Original frontend .env.local/.env.production.local created by Vercel CLI are ignored; do not print or commit them.
Local preview last responded at http://127.0.0.1:5180/.
Retired Supabase implementation is local scratch in work/retired-supabase, not deployed, not required. Current repository contains the Mongo implementation only.

## UI completion checkpoint
UI design pass committed as 1582b2a on main: shared admin/account/driver styling, admin navigation tabs, mobile product cards, responsive sign-in screen, order progress timeline, bag charges, support link, improved mobile typography and touch sizes. Preview account and driver screens are reachable without backend setup and do not fabricate live orders.
Verified phone widths 320 and 390 (no page overflow in storefront/admin/driver), admin tabs, product editor open/close, mobile and desktop sign-in layouts, no browser console errors, production build and 10 frontend tests. Vercel production deployment initiated for this version; check latest deployment status. Backend integration/payment/email limitations above still apply.

## Guest checkout change (superseded)
Customer checkout now skips email/sign-in OTP. Name, phone, delivery address and pincode remain required, and only captured verified payment permits fulfillment. A signed HttpOnly guest session scopes order history to that browser for seven days. Clearing cookies or changing devices loses self-service access; the UI explains this. Staff admin/driver sign-in remains protected, and guest sessions cannot enrol as drivers or edit store data. Customer payment no longer depends on an email provider. Seven Mongo integration tests now pass, including the guest permissions/phone/payment case. Real hosted payment testing remains incomplete.

## Email OTP restored — September 17
Customer sign-in and checkout again require email OTP. The guest endpoint is removed and existing guest cookies are rejected. Checkout requires phone, name, address and pincode; captured verified payment is still mandatory. All seven Mongo integration tests and ten frontend/utility tests pass; the output frontend production build passes. Brevo sender lookup from this computer returned an IP-authorisation error. Sender email has been requested; email delivery is not yet verified. No credentials are stored in this repository.

## Hosted checkpoint — September 19
Commit 54de222 is pushed to GitHub and successfully deployed on the existing Render backend. BREVO_API_KEY is saved in Render only. SMTP_FROM_EMAIL is still missing: the user needs to provide a verified Brevo sender email (no additional application code required). Local Brevo lookup was blocked by IP authorisation. Live health confirms MongoDB connected, Cloudinary configured, Razorpay test mode and successful test-key authentication. Checkout remains disabled pending actual checkout/webhook verification. The deployed API returns 401 for anonymous create-order. Vercel CLI requires explicit --scope peter-5cb3; deployment without it failed authorization. The frontend is still a design preview until VITE_GROCERY_API is configured. Do not claim the store is launch-ready.

## Sender and storefront connection
SMTP_FROM_EMAIL and SMTP_FROM_NAME are now configured in Render with the user-provided sender and Kalna Daily. Health reports emailConfigured true. Vercel production now has VITE_GROCERY_API=/api/grocery and deployment dpl_44iSoRWVLw8kmFaV5SN2cq2dpxCt is READY. The storefront is connected to existing Mongo; checkout remains disabled. Browser test of login reached the backend but Brevo returned 401 for unrecognised Render IP 74.220.48.235. User must authorise that IP at https://app.brevo.com/security/authorised_ips before retesting email. Email delivery and login completion remain unverified.
