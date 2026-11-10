const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('ZI dashboard is present and its browser client uses protected ZI APIs', () => {
  const page = fs.readFileSync(path.join(root, 'public/zi.html'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'public/zi.js'), 'utf8');
  assert.match(page, /Meet ZI/);
  assert.match(page, /read-only/);
  assert.match(client, /\/api\/zi\/overview/);
  assert.match(client, /\/api\/zi\/ask/);
});

test('ZI API endpoints require the administrator role and use live marketplace records', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(server, /app\.get\('\/api\/zi\/overview',requireAdmin/);
  assert.match(server, /app\.post\('\/api\/zi\/ask',requireAdmin/);
  assert.match(server, /FROM orders/);
  assert.match(server, /FROM products/);
  assert.match(server, /FROM seller_applications/);
  assert.match(server, /zi_question/);
});

test('administrator can find ZI from the signed-in account and main navigation', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.match(html, /id="ziNavLink"/);
  assert.match(app, /OPEN ZI INTELLIGENCE/);
  assert.match(app, /zi\.hidden=user\?\.role!==\'admin\'/);
});
