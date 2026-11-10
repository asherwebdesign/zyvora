const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('all advertised interface languages have a translation dictionary and RTL handling', () => {
  const source = fs.readFileSync(path.join(root, 'public/preferences.js'), 'utf8');
  for (const language of ['fr','es','de','pt','it','nl','ar','hi','ja','ko','zh','sw']) {
    assert.match(source, new RegExp(`"${language}"\\s*:`), `${language} dictionary exists`);
  }
  assert.match(source, /document\.documentElement\.dir=language==='ar'\?'rtl':'ltr'/);
  assert.match(source, /zyvora-language/);
});

test('regional currency defaults use the local currency for African country choices', () => {
  const source = fs.readFileSync(path.join(root, 'public/preferences.js'), 'utf8');
  for (const pair of [/\"GH\"\s*:\s*\{\s*\"currency\"\s*:\s*\"GHS\"/, /\"KE\"\s*:\s*\{\s*\"currency\"\s*:\s*\"KES\"/, /\"ZA\"\s*:\s*\{\s*\"currency\"\s*:\s*\"ZAR\"/, /\"UG\"\s*:\s*\{\s*\"currency\"\s*:\s*\"UGX\"/, /\"TZ\"\s*:\s*\{\s*\"currency\"\s*:\s*\"TZS\"/]) {
    assert.match(source, pair, `expected ${pair}`);
  }
});

test('public storefront does not display zodiac branding symbols', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.equal(html.includes('♏'), false);
  assert.equal(html.includes('SCORPIO SPIRIT'), false);
});
