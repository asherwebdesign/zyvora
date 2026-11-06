# ZYVORA Build 14 — Operations completion

## Payouts
- Added seller bank selection and account-name resolution through Paystack.
- Added transfer recipient creation without storing full seller account numbers.
- Added admin approval/rejection and explicit Paystack transfer initiation.
- Added OTP finalization, transfer verification, webhook reconciliation, idempotent provider events, reversal ledger handling and refusal to manually mark a transfer paid.
- Shortened transfer references to Paystack's documented 16–50 character format.
- Definite API rejections become failed payout attempts; ambiguous timeouts remain in reconciliation rather than risking duplicate transfers.

## Shipping
- Added Shipbubble address validation, live rate retrieval, admin-confirmed label booking, waybill/tracking persistence and safe duplicate-booking guards.
- Ambiguous booking timeouts require manual carrier reconciliation; definite rejection can be corrected and retried.
- Added paginated scheduled shipment status reconciliation and order event updates.
- Added product shipping weights and CSV bulk catalogue import.

## Operations and protection
- Added AES-256-GCM encrypted PostgreSQL backup and guarded restore scripts.
- Added S3-compatible off-site backup upload with AWS Signature Version 4, backup encryption-key validation and local retention pruning.
- Production backup refuses to run without configured off-site storage.
- Added a Render Cron template for daily encrypted backups and 30-minute courier sync.
- Added database readiness/liveness health checks, request IDs, structured logs, alerts, API/auth rate limits, Helmet and same-origin mutation checks.

## Verification
- Syntax checks and automated source/helper tests are included. Live provider activity still requires the owner's Paystack, Shipbubble, Cloudinary, S3 and Render accounts/credentials; the archive does not contain credentials and has not performed a live payout, carrier booking, remote backup or production deploy.


# ZYVORA Build 15 — Hero and category-rail refinement

- Repositioned the transparent hero ENTER link so its keyboard focus and pointer target align over the ENTER control already printed in the supplied dragon artwork.
- Kept the artwork as the single visual hero; no duplicate title, button, or category artwork is drawn over it.
- Replaced the multi-row category-card grid with one continuous horizontal scrolling rail. All seven cards share one landscape size and stay aligned on one row on desktop and mobile.
- Added accessible previous/next category-rail controls with reduced-motion support.
- Preserved delegated category filtering so the hero shortcuts and collection cards continue filtering the shop.


# ZYVORA Build 16 — Visual cleanup and realm cards

- Removed the visible mouse-hover outline and floating shadow from the transparent hero ENTER link. The focus indicator appears only for keyboard focus and shares the ENTER target bounds.
- Recalibrated the invisible ENTER hit area against the supplied 1536 × 782 dragon artwork. The artwork itself remains unchanged and is displayed at natural proportions.
- Rebuilt the seven category tiles as one continuous, equal-width horizontal row on desktop, with one-row horizontal scrolling on narrower screens.
- Added distinct restrained color atmospheres for Fashion, Beauty, Jewellery, Shoes, Bags, Accessories and Lifestyle so each tile reads as its own realm.
- Increased realm tile height to 224px on desktop and 205px on mobile, while reducing the large vertical gap before the product catalogue.
- Added stylesheet cache-busting (`styles.css?v=16`) to prevent browsers from reusing an older design.
- Retained the Build 14 marketplace operations, payment, courier, backup, and monitoring code from Build 15. Provider credentials and live service activation remain external setup items.


# ZYVORA Build 17 — database and deployment foundation

- Added strict DATABASE_URL validation before PostgreSQL pool creation.
- Production mode rejects localhost/loopback DB URLs with a Render-specific correction.
- Added `npm run doctor` for a credential-safe database connection check.
- Added explicit connection timeout, bounded pool size and graceful process shutdown.
- Changed the local example database path to lowercase `/zyvora`.
- Changed sample product seeding to opt-in; real inventory is not fabricated.
- Set the Render Blueprint resources to Free for initial short-term tests and documented the 30-day Postgres expiry.
- Updated the storefront CSS cache key to `v=17`.
