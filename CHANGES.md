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


## Build 35
- Based on the complete original Build 17 source, preserving the original design, assets, music and marketplace backend.
- Added admin-only ZI live operations dashboard, protected APIs, audit logging and tests.

## Build 40 — regional language and currency preference refinement
- Expanded the storefront phrase dictionary for all 12 advertised interface languages: English, French, Spanish, German, Portuguese, Italian, Dutch, Arabic, Hindi, Japanese, Korean, Chinese and Swahili.
- Added right-to-left document direction for Arabic and language-aware placeholder translation for supported phrases.
- Connected the shared translation engine to the standalone regional-settings page.
- Corrected regional default display currencies for Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Egypt and Morocco; added matching currency choices.
- Removed visible zodiac glyphs and the explicit “SCORPIO SPIRIT” label from the storefront's text branding while retaining the dark cinematic brand direction.
- Added automated regression tests for language dictionaries, RTL behavior, regional currency defaults and the storefront branding rule.
- Important scope note: these are curated interface translations, not a complete professional translation of every seller-written product description, policy, marketplace workspace screen or AI response. Seller content remains in its submitted language. Currency selection remains a display preference; it does not create live FX rates or change NGN settlement.

## Checkout hardening update
- Checkout now validates every submitted product ID and quantity instead of silently clamping invalid quantities.
- Duplicate product lines are consolidated before price and stock validation, preventing duplicate-line quantity checks from bypassing the per-item limit.
- Server-side prices remain authoritative; each line is rebuilt from the database and invalid stored prices are rejected.
- Failed Paystack initialization now marks the pending order as failed, preventing it from appearing to be a normal awaiting-payment order.
- Verification: `npm run check` passed; `npm test` passed (65 tests).


# ZYVORA Build 46 — ZI Beauty Intelligence

- Added a guided beauty discovery experience to the storefront, with selectable beauty goals, product types and NGN budgets.
- Recommendations are drawn only from live, approved, in-stock Beauty catalogue entries; sample previews are excluded.
- Added product detail links and retained the existing add-to-bag/product purchase flow.
- Added responsive obsidian-and-gold styling and clear non-medical-advice / non-affiliation disclosures.
- Added regression coverage for the feature and updated the storefront stylesheet cache key to v46.

## ZYVORA — Personal discovery refinement
- Added a recently viewed collection that remembers up to eight product details opened on the same browser/device.
- The collection reuses the existing product cards and product detail/purchase flow; it does not create products or change stock.
- Added a clear-history control. The history is local to the browser and is not synced across devices.
- Preserved the existing storefront structure, dragon artwork, original music player, music tracks and video assets.
- Verification: JavaScript syntax checks and all 67 automated tests passed. Live database, payment, shipping and deployment integrations still require their external setup and verification.
