const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
const marketplace = fs.readFileSync(path.join(root, 'public', 'marketplace.js'), 'utf8');

test('seller and admin middleware are initialised before protected routes', () => {
  const sellerUse = server.indexOf('app.post("/api/sellers/uploads/image",requireSeller');
  const sellerDecl = server.indexOf('const requireSeller=requireRole("seller")');
  const adminUse = server.indexOf("app.get('/api/admin/commission-rules',requireAdmin");
  const adminDecl = server.indexOf('const requireAdmin=requireRole("admin")');
  assert.ok(sellerDecl >= 0 && sellerDecl < sellerUse, 'seller middleware must exist before route registration');
  assert.ok(adminDecl >= 0 && adminDecl < adminUse, 'admin middleware must exist before route registration');
});

test('database schema includes core marketplace records', () => {
  for (const table of ['seller_applications','seller_stores','seller_commissions','commission_rules','marketplace_ledger','seller_payout_requests','customer_wishlist','order_events','support_tickets','admin_audit_log']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`), `${table} table is required`);
  }
});

test('marketplace workspace calls the seller and admin API surfaces', () => {
  for (const route of ['/api/sellers/me','/api/sellers/products','/api/sellers/orders','/api/sellers/payouts','/api/admin/seller-applications','/api/admin/commission-rules','/api/admin/payouts','/api/admin/audit']) {
    assert.ok(marketplace.includes(route), `workspace should use ${route}`);
  }
});

test('public product endpoint filters unapproved listings', () => {
  assert.match(server, /FROM products WHERE stock >= 0 AND approved=TRUE/);
});
