const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const app = fs.readFileSync('public/app.js', 'utf8');
const css = fs.readFileSync('public/styles.css', 'utf8');
test('recently viewed products are stored locally, limited, rendered and clearable', () => {
  assert.match(html, /id="recently-viewed"/);
  assert.match(html, /id="recentProductGrid"/);
  assert.match(html, /id="clearRecentlyViewed"/);
  assert.match(app, /function rememberViewedProduct/);
  assert.match(app, /zyvora-recently-viewed/);
  assert.match(app, /slice\(0,8\)/);
  assert.match(app, /renderRecentlyViewed\(\)/);
  assert.match(css, /recently-viewed\[hidden\]/);
});
