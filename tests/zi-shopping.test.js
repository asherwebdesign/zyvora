const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('storefront includes the ZI shopping companion and voice controls', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'public/zi-shopping.js'), 'utf8');
  assert.match(html, /id="ziCompanionToggle"/);
  assert.match(html, /id="ziCompanionVoice"/);
  assert.match(html, /id="ziCompanionForm"/);
  assert.match(client, /SpeechRecognition/);
  assert.match(client, /speechSynthesis/);
});

test('ZI shopping searches the approved catalogue and never fabricates a result list', () => {
  const client = fs.readFileSync(path.join(root, 'public/zi-shopping.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(client, /\/api\/products\/search/);
  assert.match(client, /current catalogue/);
  assert.match(client, /I will not make up products/);
  assert.match(server, /app\.get\("\/api\/products\/search"/);
  assert.match(server, /approved=TRUE AND stock>0/);
  assert.match(server, /is_sample:sampleSlugs\.has\(row\.slug\)/);
});

test('ZI can add selected search results to the existing bag but checkout always requires the customer', () => {
  const client = fs.readFileSync(path.join(root, 'public/zi-shopping.js'), 'utf8');
  assert.match(client, /window\.addToBag\(id\)/);
  assert.match(client, /without your confirmation/);
  assert.match(client, /open the shopping bag/i);
});

test('new registration and returning sign-in have distinct spoken greetings', () => {
  const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.match(app, /Welcome back to ZYVORA/);
  assert.match(app, /A new world of discovery is waiting for you/);
  assert.match(app, /speakAccountWelcome\(user\.name,signup\)/);
});
