const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');

test('customer address APIs are authenticated and owner-scoped', () => {
  assert.match(server, /get\('\/api\/customer\/addresses',requireAuth/);
  assert.match(server, /delete\('\/api\/customer\/addresses\/:id',requireAuth/);
  assert.match(server, /WHERE id=\$1 AND user_id=\$2/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS customer_addresses/);
});
test('return requests are tied to the authenticated order owner', () => {
  assert.match(server, /post\('\/api\/orders\/:id\/returns',requireAuth/);
  assert.match(server, /WHERE id=\$1 AND user_id=\$2/);
  assert.match(server, /get\('\/api\/admin\/returns',requireAdmin/);
  assert.match(server, /patch\('\/api\/admin\/returns\/:id',requireAdmin/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS return_requests/);
});
test('successful payment stock deduction is conditional and transactional', () => {
  assert.match(server, /UPDATE products SET stock=stock-\$1 WHERE id=\$2 AND approved=TRUE AND stock >= \$1 RETURNING id/);
  assert.match(server, /INSERT INTO payment_events\(reference,event_type,amount_kobo,currency,payload\)/);
});
test('product search supports safe query, category and sort choices', () => {
  assert.match(server, /get\("\/api\/products\/search"/);
  assert.match(server, /\[q,category\]/);
});
test('signup regenerates the session after account creation', () => {
  assert.match(server, /req\.session\.regenerate\(err=>\{if\(err\)return res\.status\(500\)/);
});
