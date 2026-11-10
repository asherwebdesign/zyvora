const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

test('fallback catalogue entries are explicitly sample-only', () => {
  const block = app.slice(app.indexOf('const fallbackProducts='), app.indexOf('const ZYVORA_FX='));
  assert.equal((block.match(/is_sample:true/g) || []).length, 14);
  for (const category of ['Fashion','Beauty','Jewellery','Shoes','Bags','Accessories','Lifestyle']) assert.match(block, new RegExp(`category:'${category}'`));
  assert.match(app, /p\.is_sample\?'SAMPLE PRODUCT'/);
  assert.match(app, /SAMPLE PREVIEW — NOT FOR SALE/);
  assert.match(app, /SOLD OUT/);
});

test('empty successful inventory response falls back to visible samples', () => {
  assert.match(app, /products=live\.length\?live:fallbackProducts/);
});

test('hero category decorative circles are disabled', () => {
  assert.match(css, /\.hero-category-button::after\{content:none!important;display:none!important/);
});

test('account success speaks a personalized welcome', () => {
  assert.match(app, /function speakAccountWelcome\(name\)/);
  assert.match(app, /speakAccountWelcome\(user\.name(?:,signup)?\)/);
});

test('ZI Intelligence page remains linked from the storefront', () => {
  assert.match(html, /href="\/zi\.html" id="ziNavLink"/);
  assert.ok(fs.existsSync(path.join(root, 'public/zi.html')));
  assert.ok(fs.existsSync(path.join(root, 'public/zi.js')));
});
