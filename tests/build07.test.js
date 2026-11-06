const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const server = fs.readFileSync('server.js', 'utf8');
const schema = fs.readFileSync('schema.sql', 'utf8');

test('seller store customisation is seller-authenticated and owner-scoped', () => {
  assert.match(server, /patch\("\/api\/sellers\/store",requireSeller/);
  assert.match(server, /WHERE user_id=\$7 RETURNING \*/);
});

test('seller orders are filtered by seller product ownership', () => {
  assert.match(server, /get\("\/api\/sellers\/orders",requireSeller/);
  assert.match(server, /jsonb_array_elements\(o\.items\)/);
});

test('customer cart is persisted and quantity-limited', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS customer_cart_items/);
  assert.match(server, /put\("\/api\/customer\/cart\/:productId",requireAuth/);
  assert.match(server, /quantity<1\|\|quantity>20/);
});

test('payment references have a unique idempotency record', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS payment_events/);
  assert.match(schema, /reference TEXT NOT NULL UNIQUE/);
});

test('order tracking requires an authenticated owner', () => {
  assert.match(server, /get\('\/api\/orders\/:id\/tracking',requireAuth/);
  assert.match(server, /WHERE id=\$1 AND user_id=\$2/);
});

test('admin can manage sellers, tracking and support tickets', () => {
  assert.match(server, /get\('\/api\/admin\/sellers',requireAdmin/);
  assert.match(server, /patch\('\/api\/admin\/orders\/:id\/tracking',requireAdmin/);
  assert.match(server, /get\('\/api\/admin\/support\/tickets',requireAdmin/);
});
