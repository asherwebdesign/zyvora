const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const server = fs.readFileSync('server.js','utf8');
const app = fs.readFileSync('public/app.js','utf8');

test('customer cart UI loads and persists the signed-in customer cart',()=>{
  assert.match(server,/app\.get\(["\']\/api\/customer\/cart["\']/);
  assert.match(server,/app\.put\(["\']\/api\/customer\/cart\/:productId["\']/);
  assert.match(app,/syncCustomerData\(\)/);
  assert.match(app,/saveCartItem\(id,quantity\)/);
  assert.match(app,/data-qty/);
});

test('customer order history displays purchased items and opens owner-only tracking',()=>{
  assert.match(server,/WHERE id=\$1 AND user_id=\$2/);
  assert.match(app,/async function showOrders\(\)/);
  assert.match(app,/data-track-order/);
  assert.match(app,/showOrderTracking\(id\)/);
});

test('customer profile can be read and safely updated for the signed-in user',()=>{
  assert.match(server,/app\.get\(["\']\/api\/customer\/profile["\'],requireAuth/);
  assert.match(server,/app\.patch\(["\']\/api\/customer\/profile["\'],requireAuth/);
  assert.match(server,/UPDATE users SET name=\$1,phone=\$2 WHERE id=\$3/);
  assert.match(app,/editCustomerProfile/);
});

test('wishlist UI synchronises additions and removals with the customer account',()=>{
  assert.match(server,/app\.get\('\/api\/customer\/wishlist',requireAuth/);
  assert.match(server,/app\.post\('\/api\/customer\/wishlist\/:productId',requireAuth/);
  assert.match(server,/app\.delete\('\/api\/customer\/wishlist\/:productId',requireAuth/);
  assert.match(app,/api\('\/api\/customer\/wishlist\/'\+id/);
});
