const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const app = fs.readFileSync('public/app.js', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');
test('Build 46 adds guided ZI Beauty Intelligence to the storefront', () => {
  assert.match(html, /id="beauty-intelligence"/);
  assert.match(html, /id="beautyFinder"/);
  assert.match(html, /name="goal"/);
  assert.match(html, /name="kind"/);
  assert.match(html, /name="budget"/);
  assert.match(app, /function runBeautyFinder/);
  assert.match(app, /p\.category\|\|''\)\.toLowerCase\(\)==='beauty'/);
  assert.match(app, /!p\.is_sample/);
  assert.match(app, /Number\(p\.stock\)>0/);
  assert.match(css, /Build 46 — guided ZI Beauty Intelligence/);
  assert.match(html, /styles\.css\?v=47/);
});
