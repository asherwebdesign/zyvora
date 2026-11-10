const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const html = read('public/index.html');
const css = read('public/styles.css');

test('Build 17 uses one canonical dragon artwork and cache-busted stylesheet', () => {
  assert.match(html, /<img class="hero-image" src="\/dragon-hero\.jpg"/);
  assert.match(html, /href="\/styles\.css\?v=47"/);
  assert.equal((html.match(/class="hero-image"/g) || []).length, 1);
});

test('Build 17 ENTER hotspot is invisible on hover and has keyboard-only focus feedback', () => {
  assert.match(css, /\.hero-enter-hotspot\s*\{[^}]*left:\s*41\.0%;[^}]*top:\s*62\.7%;/s);
  assert.match(css, /\.hero-enter-hotspot:hover,\s*\.hero-enter-hotspot:active\s*\{[^}]*outline:\s*0;[^}]*box-shadow:\s*none;/s);
  assert.match(css, /\.hero-enter-hotspot:focus-visible\s*\{/);
});

test('all seven category tiles are one horizontal flex rail, never a desktop grid', () => {
  assert.match(html, /class="realm-grid" id="realmGrid"/);
  assert.match(css, /\.realm-grid\s*\{[^}]*display:\s*flex\s*!important;[^}]*flex-flow:\s*row nowrap\s*!important;/s);
  assert.match(css, /\.realm\s*\{[^}]*height:\s*224px\s*!important;/s);
  for (const category of ['Fashion','Beauty','Jewellery','Shoes','Bags','Accessories','Lifestyle']) {
    assert.match(html, new RegExp(`class="realm[^\"]*" data-filter="${category}"`));
  }
});

test('Build 17 reduces the excessive empty vertical gap between collections and the shop', () => {
  assert.match(css, /\.realms\s*\{[^}]*padding-bottom:\s*40px\s*!important;/s);
  assert.match(css, /\.shop\.section\s*\{[^}]*padding-top:\s*64px;/s);
});
