CREATE TABLE IF NOT EXISTS users (
 id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'customer',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS products (
 id BIGSERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
 category TEXT NOT NULL, description TEXT NOT NULL, details TEXT NOT NULL DEFAULT '',
 price_kobo BIGINT NOT NULL, compare_at_kobo BIGINT, image_url TEXT NOT NULL,
 rating NUMERIC(2,1) NOT NULL DEFAULT 4.8, review_count INTEGER NOT NULL DEFAULT 0,
 stock INTEGER NOT NULL DEFAULT 20, featured BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS orders (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id),
 email TEXT NOT NULL, customer_name TEXT NOT NULL, phone TEXT NOT NULL,
 shipping_address JSONB NOT NULL, items JSONB NOT NULL,
 subtotal_kobo BIGINT NOT NULL, shipping_kobo BIGINT NOT NULL DEFAULT 0,
 total_kobo BIGINT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_payment',
 payment_reference TEXT UNIQUE, payment_status TEXT NOT NULL DEFAULT 'unpaid',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
 id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE TABLE IF NOT EXISTS seller_applications (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 store_name TEXT NOT NULL, business_type TEXT NOT NULL, country TEXT NOT NULL,
 description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id)
);
CREATE TABLE IF NOT EXISTS reviews (
 id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(product_id,user_id)
);
CREATE TABLE IF NOT EXISTS seller_stores (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 store_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;


-- Marketplace seller profile and automatic commission ledger.
ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS website TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS social_handle TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS seller_commissions (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 seller_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 gross_kobo BIGINT NOT NULL, commission_rate_bps INTEGER NOT NULL,
 commission_kobo BIGINT NOT NULL, seller_net_kobo BIGINT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(order_id,seller_id)
);
CREATE INDEX IF NOT EXISTS seller_commissions_seller_idx ON seller_commissions(seller_id,created_at DESC);


-- Build 04 marketplace operations
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE seller_stores ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_stores ADD COLUMN IF NOT EXISTS banner_url TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_stores ADD COLUMN IF NOT EXISTS tagline TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_stores ADD COLUMN IF NOT EXISTS theme_color TEXT NOT NULL DEFAULT '#b7ff3c';
ALTER TABLE seller_stores ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_note TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_fee_kobo BIGINT NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS commission_rules (
 id BIGSERIAL PRIMARY KEY, scope TEXT NOT NULL CHECK(scope IN ('global','seller','category')),
 scope_key TEXT NOT NULL DEFAULT '*', rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 0 AND 5000),
 active BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(scope,scope_key)
);
INSERT INTO commission_rules(scope,scope_key,rate_bps) VALUES('global','*',1000) ON CONFLICT(scope,scope_key) DO NOTHING;
ALTER TABLE seller_commissions ADD COLUMN IF NOT EXISTS refunded_gross_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE seller_commissions ADD COLUMN IF NOT EXISTS refunded_commission_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE seller_commissions ADD COLUMN IF NOT EXISTS payment_fee_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE seller_commissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS marketplace_ledger (
 id BIGSERIAL PRIMARY KEY, seller_id BIGINT REFERENCES users(id), order_id BIGINT REFERENCES orders(id),
 entry_type TEXT NOT NULL, amount_kobo BIGINT NOT NULL, reference TEXT UNIQUE NOT NULL,
 description TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS seller_payout_requests (
 id BIGSERIAL PRIMARY KEY, seller_id BIGINT NOT NULL REFERENCES users(id), amount_kobo BIGINT NOT NULL CHECK(amount_kobo>0),
 bank_name TEXT NOT NULL, account_name TEXT NOT NULL, account_number_last4 TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','paid')),
 admin_note TEXT NOT NULL DEFAULT '', provider_reference TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_wishlist (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,product_id)
);
CREATE TABLE IF NOT EXISTS order_events (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 status TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_user_id BIGINT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS support_tickets (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id), email TEXT NOT NULL, subject TEXT NOT NULL,
 message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admin_audit_log (
 id BIGSERIAL PRIMARY KEY, admin_id BIGINT REFERENCES users(id), action TEXT NOT NULL, target_type TEXT NOT NULL,
 target_id TEXT NOT NULL DEFAULT '', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ledger_seller_idx ON marketplace_ledger(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS payout_seller_idx ON seller_payout_requests(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events(order_id,created_at);


-- Build 07: persisted customer carts and payment idempotency records.
CREATE TABLE IF NOT EXISTS customer_cart_items (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 20),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS payment_events (
 id BIGSERIAL PRIMARY KEY, reference TEXT NOT NULL UNIQUE, event_type TEXT NOT NULL,
 amount_kobo BIGINT NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'NGN',
 payload JSONB NOT NULL DEFAULT '{}'::jsonb, processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_kobo BIGINT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider TEXT NOT NULL DEFAULT '';

-- Build 11: saved delivery addresses and customer return/exchange workflow.
CREATE TABLE IF NOT EXISTS customer_addresses (
 id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 label TEXT NOT NULL DEFAULT 'Home', recipient_name TEXT NOT NULL, phone TEXT NOT NULL,
 address_line TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL, postal_code TEXT NOT NULL DEFAULT '',
 country TEXT NOT NULL, is_default BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_addresses_user_idx ON customer_addresses(user_id,is_default DESC);
CREATE TABLE IF NOT EXISTS return_requests (
 id BIGSERIAL PRIMARY KEY, order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('return','exchange')), reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','received','refunded','exchanged','closed')),
 admin_note TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(order_id,user_id)
);
CREATE INDEX IF NOT EXISTS return_requests_status_idx ON return_requests(status,created_at DESC);


-- Build 14: seller payout transfers, courier bookings and product shipping weights.
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3) NOT NULL DEFAULT 0.500;
ALTER TABLE seller_payout_requests ADD COLUMN IF NOT EXISTS bank_code TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_payout_requests ADD COLUMN IF NOT EXISTS recipient_code TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_payout_requests ADD COLUMN IF NOT EXISTS transfer_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_payout_requests ADD COLUMN IF NOT EXISTS transfer_code TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_payout_requests ADD COLUMN IF NOT EXISTS provider_status TEXT NOT NULL DEFAULT '';
ALTER TABLE seller_payout_requests DROP CONSTRAINT IF EXISTS seller_payout_requests_status_check;
ALTER TABLE seller_payout_requests ADD CONSTRAINT seller_payout_requests_status_check CHECK(status IN ('requested','approved','rejected','transferring','otp_required','paid','failed','reversed'));
CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_transfer_reference_unique ON seller_payout_requests(transfer_reference) WHERE transfer_reference <> '';
CREATE TABLE IF NOT EXISTS payout_provider_events (
 id BIGSERIAL PRIMARY KEY, provider_event_ref TEXT NOT NULL UNIQUE,
 payout_id BIGINT NOT NULL REFERENCES seller_payout_requests(id) ON DELETE CASCADE,
 event_type TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS payout_provider_events_payout_idx ON payout_provider_events(payout_id,created_at DESC);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_recipient_address_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_request_token TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_rate_options JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider_order_id TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_tracking_url TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_waybill_url TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS orders_shipping_provider_order_idx ON orders(shipping_provider_order_id) WHERE shipping_provider_order_id <> '';


-- Build 14.1: prevent accidental duplicate courier label creation.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_booking_status TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_booking_courier_id TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_booking_service_code TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS orders_shipping_booking_status_idx ON orders(shipping_booking_status) WHERE shipping_booking_status <> '';

-- Build 14.2: persisted courier state for scheduled status reconciliation.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_provider_status TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_last_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS orders_shipbubble_active_idx ON orders(shipping_provider_order_id) WHERE shipping_booking_status='booked' AND shipping_provider_order_id<>'';
