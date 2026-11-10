const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('welcome artwork is used once without duplicate overlaid title or category rail copy', () => {
  assert.match(html, /<img class="hero-image" src="\/dragon-hero\.jpg"/);
  assert.doesNotMatch(html, /class="hero-copy"/);
  assert.doesNotMatch(html, /<h1>ZYVORA<\/h1>/);
  assert.equal((html.match(/class="hero-category-rail"/g) || []).length, 1);
});

test('desktop image hotspots and mobile category shortcuts cover all seven categories', () => {
  const categories = ['Fashion', 'Beauty', 'Jewellery', 'Shoes', 'Bags', 'Accessories', 'Lifestyle'];
  for (const category of categories) {
    assert.match(html, new RegExp(`data-filter="${category}"`));
  }
  assert.match(html, /class="hero-enter-hotspot" href="#collections"/);
  assert.match(html, /class="mobile-category-shortcuts"/);
  assert.match(app, /document\.addEventListener\('click'/);
  assert.match(app, /\$\$\('\[data-filter\]'\)/);
});

test('collection cards stay in one continuous horizontal row with narrow-screen scrolling', () => {
  assert.match(html, /class=\"realm-rail-shell\"/);
  assert.match(html, /class=\"realm-grid\" id=\"realmGrid\"/);
  assert.match(css, /\.realm-grid\s*\{[^}]*display:\s*flex\s*!important;[^}]*flex-flow:\s*row nowrap\s*!important;/s);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /\.realm\s*\{[^}]*height:\s*224px\s*!important;/s);
});

test('ENTER hit area is aligned with the printed button and does not draw a mouse-hover oval', () => {
  assert.match(css, /\.hero-enter-hotspot\s*\{[^}]*left:\s*41\.0%;[^}]*top:\s*62\.7%;/s);
  assert.match(css, /\.hero-enter-hotspot:hover,\s*\.hero-enter-hotspot:active\s*\{[^}]*outline:\s*0;[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.hero-enter-hotspot:focus-visible/);
});

test('starter product rows supply an explicit stock value to the 12-column insert', () => {
  assert.match(server, /\[\.\.\.p\.slice\(0, 10\), 0, p\[10\]\]/);
});

test('original local dragon ambience assets are retained in the full project package', () => {
  for (const asset of ['zyvora-dragon.mp4', 'zyvora-ambient-track.mp3', 'zyvora-original-dragon-theme.mp3']) {
    assert.ok(fs.existsSync(path.join(root, 'public', 'assets', asset)), `${asset} should be included`);
  }
});
