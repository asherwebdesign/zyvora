# ZYVORA

Complete ZYVORA marketplace project with the image-first dragon welcome screen, obsidian-black / warm-gold storefront, customer experience, seller centre, admin operations, PostgreSQL persistence, Paystack payment/refund and seller-transfer workflows, Shipbubble delivery operations, encrypted off-site backups, CSV product imports, health checks and operations alerts.


## Project setup and deployment

The ZYVORA project retains its original storefront and marketplace experience. Build labels are internal development notes only; the brand and project folder remain ZYVORA.

- `DATABASE_URL` is now mandatory. The application fails immediately with a clear configuration message instead of allowing node-postgres to silently attempt its default `localhost:5432` connection.
- Production startup rejects localhost database URLs and instructs the operator to use the cloud database's Internal Database URL.
- PostgreSQL connections use bounded pool settings and a 10-second connection timeout. Idle pool errors are logged without printing credentials.
- `npm run doctor` checks the configured database connection and reports the host/database name while keeping credentials hidden.
- The local `.env.example` now targets the lowercase database name `zyvora`, matching the fresh pgAdmin database created for Build 17.
- Sample catalogue products are disabled by default (`SEED_SAMPLE_PRODUCTS=false`). The store does not pretend unverified sample rows are real inventory. Enable sample data only for a temporary visual preview.
- SIGINT/SIGTERM now close the HTTP server and PostgreSQL pool cleanly.
- The stylesheet cache key is updated to Build 17.

### Local database setup

Copy `.env.example` to `.env`, then set `DATABASE_URL` to the PostgreSQL 18 connection string for the local `zyvora` database. Use the password configured for your local PostgreSQL role; never share it in chat. The expected shape is:

```text
postgresql://postgres:YOUR_URL_ENCODED_PASSWORD@localhost:5432/zyvora
```

If the password contains reserved URL characters (for example `@`, `:`, `/`, `#` or `%`), URL-encode those characters before placing the password in the URL. Then run `npm install`, `npm run doctor`, and `npm run dev`. `npm run doctor` must report `DATABASE CONNECTION: OK` before starting the web server.

### Render database setup

The included `render.yaml` is a Render Blueprint for a `zyvora-store` Node web service plus a `zyvora-db` Postgres database. It injects the database connection string into `DATABASE_URL` and generates `SESSION_SECRET`.

Both resources are set to Render's Free plan for initial testing, not permanent commerce. Render's current documentation says Free Postgres is limited to 1 GB and expires 30 days after creation; use it only for tests and choose durable paid/managed PostgreSQL before storing real customer or order data. Review Render's resource plan and terms before approving a Blueprint. Free-plan limitations are documented at [Render Deploy for Free](https://render.com/docs/free).

The web service must connect to the database's Internal Database URL from the same Render region. Never copy the local pgAdmin URL (`localhost:5432`) into Render. The local pgAdmin database and the Render database are separate databases; pgAdmin can also be configured to connect to a remote Render database if you need to inspect it.


## Run locally

1. Install Node.js 20 or newer and PostgreSQL.
2. Extract the ZIP and open the top-level `ZYVORA` folder in VS Code.
3. Copy `.env.example` to `.env`. Set `DATABASE_URL` for your PostgreSQL 18 server and the lowercase database name `zyvora`; set a private `SESSION_SECRET`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` for the first administrator.
4. Confirm the database `zyvora` exists in pgAdmin 4.
5. In the VS Code terminal run `npm install`, then `npm run doctor`. Continue only after it reports `DATABASE CONNECTION: OK`.
6. Run `npm run dev`.
7. Visit `http://localhost:3000`.

The database schema and additive migrations in `schema.sql` are applied during application startup. Keep `.env` private; it is intentionally excluded from the ZIP and Git.

## What's included

- Image-first dragon welcome artwork with seven working category click areas, mobile shortcuts, a single-row seven-realm category layout with narrow-screen horizontal scrolling and the obsidian/gold theme.
- Hero ENTER link uses an invisible mouse target aligned to the ENTER control printed in the dragon artwork; the visual focus indicator is keyboard-only, so no floating hover oval is drawn.
- Product catalogue, category/search/filter/sort, customer accounts, persisted cart, saved addresses, wishlist, checkout and order tracking.
- Seller onboarding, product submission and moderation, seller order management, commission ledger, verified payout bank accounts and payout requests.
- Admin operations for products, sellers, customers, orders, refunds, commissions, support, audit and shipping.
- CSV product import. Required headers: `name,category,description,price_ngn,stock,image_url`. Optional headers: `details,featured,weight_kg,slug`. Maximum import size is 2 MB and maximum rows per upload is 500. Prices are NGN and are converted to kobo for storage. Imported listings are admin-created catalogue entries; verify all product data before publication.
- Paystack checkout, payment verification/webhooks and provider refund requests.
- Paystack seller transfer workflow described below.
- Shipbubble live courier quotes, deliberate label booking, tracking links, waybill links and scheduled shipment-status sync.
- Structured request/error logs, request IDs, database readiness endpoint and optional ops webhook notifications.
- Encrypted PostgreSQL backup and guarded restore scripts.

## Paystack seller transfers

The payout flow is deliberately approval-based. A seller selects a bank, enters a 10-digit account number, has the account resolved through Paystack, and requests a payout. The admin reviews the request, approves it, and explicitly starts the transfer. Paystack may require an OTP; an admin can finalize it. The payout is only marked paid after a `transfer.success` webhook or verified terminal status. Failed and reversed transfers restore the seller's available balance and create accounting records.

Required production setting: `PAYSTACK_SECRET_KEY` using the secret key for the correct environment. Paystack must enable transfers for the business and the Paystack balance must be funded. In the Paystack dashboard, set the webhook URL to `https://YOUR-PUBLIC-DOMAIN/api/payments/webhook`. The existing webhook validates Paystack's HMAC signature and processes `transfer.success`, `transfer.failed` and `transfer.reversed` idempotently. Paystack recommends webhooks to confirm a transfer's final state rather than assuming that an accepted API request means the recipient has been paid. See [Paystack single transfers](https://paystack.com/docs/transfers/single-transfers/), [transfer API](https://paystack.com/docs/api/transfer/) and [transfer lifecycle](https://paystack.com/docs/transfers/how-transfers-work/).

No secret key, account number or bank details are included in this project archive. The application stores the Paystack recipient code and only the last four digits of the seller's account number.

## Shipbubble shipping

The admin can request live rates for an order, select a returned courier option, and deliberately book a label. Duplicate label requests are blocked while a booking is being processed or needs reconciliation. Definite carrier request rejections can be retried after correction; ambiguous timeouts are put into `pending_review` and must be checked in the Shipbubble dashboard before another booking is attempted. Tracking URL and waybill references are persisted.

Set:
- `SHIPBUBBLE_API_KEY`
- `SHIPBUBBLE_SENDER_ADDRESS_CODE`
- `SHIPBUBBLE_CATEGORY_ID`
- `SHIPBUBBLE_PACKAGE_LENGTH_CM`, `SHIPBUBBLE_PACKAGE_WIDTH_CM`, `SHIPBUBBLE_PACKAGE_HEIGHT_CM`
- `SHIPBUBBLE_DEFAULT_ITEM_WEIGHT_KG`

Seller product submissions can include an item weight. The admin package dimensions and per-item weights must reflect the actual packed shipment; the defaults are placeholders, not measured parcel values. Rate quotes must be checked against the customer delivery fee collected at checkout and the Shipbubble wallet charge before a label is booked. The shipping fee at checkout remains the store's current flat-rate rule; it is not automatically replaced by a courier quote.

Run `npm run shipping:sync` to reconcile booked Shipbubble statuses. `render-backup-cron-template.yaml` includes a Cron job template to run it every 30 minutes. Copy the Cron service into the `services:` list in the existing Render Blueprint and configure the `SHIPBUBBLE_API_KEY` secret. The polling script reads paginated shipment results and updates order status, tracking fields and order events when a carrier state changes. The live API is limited to shipments from the account's country of origin; confirm country support and courier coverage with Shipbubble before launch. See [Shipbubble get started](https://docs.shipbubble.com/get-started), [request shipping rates](https://docs.shipbubble.com/api-reference/rates/request-shipping-rates), [create shipment](https://docs.shipbubble.com/api-reference/shipments/create-shipment), [get shipments](https://docs.shipbubble.com/api-reference/tracking/get-shipments) and [pagination](https://docs.shipbubble.com/get-started/pagination).

## Encrypted database backups

The backup script requires PostgreSQL client tools (`pg_dump` and, for restore, `pg_restore`). Render Node native runtimes currently include these PostgreSQL client utilities; other hosts must install compatible client tools.

Create a 32-byte encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set `BACKUP_ENCRYPTION_KEY` to that value in a secure environment variable manager. Keep a separate secure copy of this key; losing it makes encrypted backups unrecoverable.

For local development only, set `BACKUP_LOCAL_ONLY=true` and run:

```bash
npm run backup
```

This creates an AES-256-GCM encrypted, compressed custom-format dump under `BACKUP_DIR` (default `./backups`). Old local files beyond `BACKUP_RETENTION_DAYS` (default 14) are pruned. Local-only backup mode refuses to run when `NODE_ENV=production`.

For production, configure all of `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY`. The encrypted object is uploaded to the S3-compatible bucket over HTTPS using signed requests. The backup job refuses to report success without off-site upload. `render-backup-cron-template.yaml` contains a daily 02:00 UTC backup Cron job template. Copy both Cron services into the existing Render Blueprint `services:` list; do not duplicate the existing `zyvora-db` database resource. Configure the encryption key and S3 values as Render secrets. Apply a bucket lifecycle policy in the storage provider to expire old remote objects according to the business retention policy; local pruning does not delete remote objects.

Restore is destructive to the target database. Verify the destination and backup first, then explicitly set `RESTORE_CONFIRM=YES`:

```bash
RESTORE_CONFIRM=YES npm run restore -- ./backups/zyvora-YYYYMMDDTHHMMSSZ.dump.gz.enc
```

On PowerShell:

```powershell
$env:RESTORE_CONFIRM = "YES"
npm run restore -- .\backups\zyvora-YYYYMMDDTHHMMSSZ.dump.gz.enc
Remove-Item Env:RESTORE_CONFIRM
```

The restore script authenticates/decrypts the encrypted archive before invoking `pg_restore --clean --if-exists`. It does not contact the storage provider to fetch remote objects; download the encrypted object from your bucket first.

## Monitoring and security

- `/api/health/live` is a process liveness check.
- `/api/health/ready` checks that PostgreSQL can answer a query and is used as the Render health check.
- API requests log structured metadata and an `X-Request-ID`; server errors include that ID in the response/logs.
- `ALERT_WEBHOOK_URL` optionally sends Slack-compatible alert messages for server errors, unhandled process errors, payout exceptions and backup outcomes.
- Helmet headers, API/auth rate limits, same-origin mutation checks and authenticated role checks are enabled.

Monitoring alerts need an incoming webhook URL; they cannot deliver alerts until one is configured. A webhook URL should be secret and restricted to the intended alert channel.

## Production configuration still required

These are real business/provider settings, not software tasks that can be fabricated in code:

- Paystack business verification, live secret key, transfer activation, webhook registration and adequate settlement/transfer funds.
- Shipbubble account, correct origin address code, package category, accurate parcel sizing/weights, courier wallet balance and API key.
- Cloudinary account keys for persistent seller product images.
- A secure S3-compatible bucket, access credentials, lifecycle policy and separately stored backup-encryption key.
- Actual supplier/product images, verified descriptions, price, parcel weights and stock levels. Sample products are not inserted unless `SEED_SAMPLE_PRODUCTS=true`; sample rows are never verified inventory.
- Business-approved delivery charges, shipping zones, tax rules, returns/refund policy, terms, privacy notice and consumer disclosures.
- Final testing in provider test mode and a real staging deployment before accepting customer funds.

## Verification boundary

`npm test` and syntax checks cover automated source contracts and selected helper behavior. They do not substitute for live Paystack transfers/refunds, Shipbubble bookings, S3 uploads/restores, browser journeys, real credentials or a production deployment. Build 14 is an application-code build, not a certification that third-party services are activated or that live transactions have been completed.


## Retained visual design from Build 16

- The original dragon artwork is still the only visible hero art. The ENTER link is a transparent click target positioned over the printed ENTER pill; mouse hover does not draw a second oval or box. A focus indicator is retained for keyboard navigation only.
- The seven collection cards use equal widths and stay in one horizontal line on desktop. Smaller screens keep the same one-row layout and can scroll it horizontally. Each realm has its own subdued color atmosphere, image treatment and gold typography.
- The oversized gap between the collection cards and the catalogue has been reduced. The stylesheet URL includes a version query to force browsers to request the new Build 17 styling.

## Automated verification

The local automated suite includes 43 tests. These tests and JavaScript/CSS/YAML syntax checks do not certify real provider credentials, live transactions, courier bookings, remote backup restore, or a production deployment. Complete those integrations in provider test environments and a protected staging deployment before accepting live orders.


## Build 35 — Original Build 17 with ZI

Build 35 returns to the complete original Build 17 codebase and adds an administrator-only ZYVORA Intelligence dashboard at `/zi.html`. ZI reads live operational counts and answers common marketplace questions using transparent rules. This initial version is read-only and does not claim a connected generative AI provider. See `BUILD_35_STATUS.md` for scope, verification and limitations.


## Build 36 — Global preferences, payment choices and voice-enabled ZI

- Expanded country/region preferences (50+ choices), display-currency options and language choices. Currency values outside NGN remain display preferences only; live FX, tax, shipping coverage and settlement currencies must be configured and verified before international checkout. The current interface has curated translations for English, French, Spanish, German, Portuguese and Italian labels; other language options are preference/voice-language selections and are not yet full-site translations.
- Checkout offers card, bank transfer, USSD and mobile-money channels through the configured Paystack account, plus pay-on-delivery when enabled. These are payment channels under the existing Paystack integration, not separate payment-provider integrations. Availability depends on Paystack account, country and currency support. No alternative gateway such as Stripe is connected in this build.
- ZI has an opt-in microphone conversation mode: start voice, say “Hey Zed” followed by a question, and ZI speaks the answer using a locally available browser voice. Browser speech recognition support and voice availability vary; no always-on wake-word listening is used. Voice interaction requires microphone permission and an authenticated administrator session.
- Existing seeded starter-catalogue products are labelled SAMPLE PRODUCT and their add-to-bag control is disabled. Real products added through the owner catalogue remain purchasable.
- Build 35 original design foundation and existing marketplace/ZI functions are retained.


## Build 37 — Voice-first ZI

Build 37 changes ZI to a voice-first, continuous conversation: tap TALK TO ZI once, hear ZI greet you, speak naturally without a wake phrase, and receive spoken replies while the microphone resumes listening for the next turn. Text chat remains available under “Prefer to type instead?”. See `BUILD_37_STATUS.md` for browser support and limitations.

## Customer account dashboard

Signed-in customers can open `/account.html` for a separate account area with profile editing, recent order history and saved products. Seller and administrator accounts are routed to `/marketplace.html` instead. The dashboard uses the existing authenticated, owner-scoped customer APIs.
