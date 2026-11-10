# ZYVORA — external setup notes

## Live exchange rates
The storefront now requests `/api/exchange-rates?base=NGN`, which fetches and caches indicative rates from open.er-api.com for six hours. These rates are for display only. Checkout and Paystack settlement remain NGN. Verify the provider's terms, availability, supported currencies and accuracy for your business before launch.

## Transactional email
The server now has a Resend adapter and sends a welcome email after signup plus order-created emails for checkout paths. Delivery remains inactive until a verified sender domain and credentials are configured privately:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SUPPORT_EMAIL`
Never put credentials in source control or send them in chat. Verify the sender domain in the email provider, publish the DNS records it supplies, and send test messages before launch.

## Supplier and stock provenance
The database schema now includes `suppliers`, supplier references on products, `inventory_verified`, and `inventory_movements`. No supplier records or real stock quantities have been invented. Populate these only from genuine supplier invoices/catalogues and physically or contractually verified stock counts. Existing sample products remain sample-only.

## Domain and HTTPS
The Render blueprint provisions the app service and database. To use a purchased domain, add it in the hosting dashboard, copy the exact DNS records shown there to the domain registrar, wait for verification, and set `BASE_URL` to the final `https://` origin. Render provisions TLS after the domain is correctly verified. A domain cannot be purchased or DNS ownership proven from this source archive.

## Legal drafts
The `legal-drafts/` directory contains working drafts for terms, privacy, returns/refunds and seller agreement. They are deliberately labelled drafts and must not be published or signed until the registered business details, launch countries, commercial decisions and qualified legal review are complete.

## Items that cannot be completed from source code alone
Real inventory, genuine supplier identities, domain purchase/ownership, business registration, tax registration/positions, and legal approval require authentic owner-provided information or action. Do not substitute invented data.
