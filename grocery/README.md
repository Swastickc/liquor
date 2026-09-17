# Kalna Daily grocery storefront

Mobile grocery storefront and PWA, backed by the existing `Swastickc/liquor` Render service and MongoDB database. No Supabase account is needed.

## Development

Use Node 22, then `npm ci`, `npm run dev`, `npm test`, and `npm run build`.
Without `VITE_GROCERY_API`, the app is an explicitly labelled local design preview. Local admin edits and the bag are stored on that device; they are not shared store data.
Set `VITE_GROCERY_API=/api/grocery` for connected mode. Vercel proxies this path to the existing Render backend. Backend source lives in the repository's `backend/grocery/` directory, mounted by `backend/server.js`. For local connected development, configure a Vite proxy to your running backend.

## Existing service configuration

The backend reuses `MONGO_URI`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and the Cloudinary environment variables. Grocery collections are separate from existing products and orders. MongoDB must support transactions (Atlas replica sets do).
Email OTP requires either `BREVO_API_KEY` and a verified `SMTP_FROM_EMAIL`, or SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_MAIL`, `SMTP_PASSWORD`). Existing owners whose email has role `admin` in the original users collection receive grocery admin access after verifying their email. Grocery sessions use their own signing key derivation and HttpOnly cookie; they do not grant access to the original application.

Routes: store `/`, admin `/#studio`, customer orders `/#account`, delivery partner `/#driver`.

Admin controls products/photos/stock, visibility, store opening hours in IST, manual closure, delivery pincodes, fees/minimum order, driver approval, dispatch and packing. Drivers request access, require owner approval, and see their assignments. The customer receives a delivery code in order history. Five wrong code attempts lock completion for 15 minutes.

## Payments and launch

Keep `GROCERY_CHECKOUT_ENABLED=false` until test-mode checkout succeeds with real test credentials. Configure a Razorpay `payment.captured` webhook to `https://kalna-liquor-backend.onrender.com/api/grocery/webhook`, with `GROCERY_RAZORPAY_WEBHOOK_SECRET`. No live payment has been tested or charged by this project setup. The health endpoint can verify test-key authentication; that is not proof of a successful checkout or webhook.

Order prices and delivery charges come from MongoDB. Reservations are atomic/idempotent, pending stock expires after 15 minutes, and a server interval releases stock while Render is running. New checkout also clears expired stock. Render Free sleeps, so expiry may be delayed while the service sleeps and first requests can take 50+ seconds. An always-on service is advisable before business launch; no paid upgrade has been made.

Payment is confirmed only for a captured payment matching provider order, amount and currency, with signature verification. Late captured payments after stock release are flagged `payment_review`; staff must arrange fulfillment or refund through Razorpay. Refund/cancellation automation, GPS tracking, SMS OTP and push notifications are not implemented. Email sign-in OTP and delivery confirmation codes are separate.

The public catalog starts empty in connected mode. Add your actual products, stock, prices, service area and contact details before opening. Demo prices and photos are not business inventory. Publish your business delivery/refund/privacy policies before accepting customer orders.

## Tests

Frontend `npm test` covers catalogue filtering, currency totals, validation, signature matching, hours, manifest and offline service-worker behavior. Backend tests use a temporary real MongoDB replica set and HTTP requests: from `backend`, run `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/grocery.test.js --runInBand`. They cover concurrent stock reservation, payment replay, expiry, permissions, OTP sessions, admin access and delivery-code lockouts. Email/provider integrations still require hosted testing; mocks do not establish real delivery.

## Design sources

Layout references: CollectUI e-commerce gallery (https://collectui.com/designs/e-commerce-ui-design-inspiration), Taras and Sai Satvik examples. These informed layout; proprietary reference artwork was not copied. React Bits AnimatedContent and SpotlightCard code comes from https://github.com/DavidHDev/react-bits; see `licenses/react-bits-LICENSE.md`. Sample product images come from DummyJSON and should be replaced with your own approved catalogue photography before launch. Icons: lucide-react.
