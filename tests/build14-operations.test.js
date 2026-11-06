const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const server = read('server.js');
const schema = read('schema.sql');
const packageJson = JSON.parse(read('package.json'));
const backup = read('scripts/backup-postgres.js');
const restore = read('scripts/restore-postgres.js');
const shipmentSync = read('scripts/sync-shipments.js');
const cron = read('render-backup-cron-template.yaml');

test('seller payouts use Paystack verification and only final provider events settle a payout', () => {
  assert.match(server, /\/api\/sellers\/payout-account\/resolve/);
  assert.match(server, /\/api\/admin\/payouts\/:id\/transfer/);
  assert.match(server, /\/transfer\/finalize_transfer/);
  assert.match(server, /transfer\.success.*transfer\.failed.*transfer\.reversed/s);
  assert.match(server, /zyp-\$\{payout\.id\}-\$\{crypto\.randomBytes\(12\)\.toString\('hex'\)\}/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS payout_provider_events/);
  assert.doesNotMatch(server, /status='paid'.*admin/i);
});

test('courier operations quote, book idempotently and persist paginated carrier status updates', () => {
  assert.match(server, /shipping\/fetch_rates/);
  assert.match(server, /shipping\/labels/);
  assert.match(server, /'pending_review'/);
  assert.match(schema, /shipping_provider_status TEXT NOT NULL DEFAULT ''/);
  assert.match(shipmentSync, /PerPage=200/);
  assert.match(shipmentSync, /pagination\?\.next/);
  assert.match(shipmentSync, /carrier_\$\{carrierStatus\}/);
  assert.match(packageJson.scripts['shipping:sync'], /sync-shipments\.js/);
});

test('encrypted backups require a 32-byte key and off-site production storage', () => {
  assert.match(backup, /createCipheriv\('aes-256-gcm'/);
  assert.match(backup, /BACKUP_ENCRYPTION_KEY/);
  assert.match(backup, /BACKUP_LOCAL_ONLY === 'true' && process\.env\.NODE_ENV !== 'production'/);
  assert.match(backup, /AWS4-HMAC-SHA256/);
  assert.match(backup, /BACKUP_S3_BUCKET/);
  assert.match(restore, /RESTORE_CONFIRM !== 'YES'/);
  assert.match(restore, /--clean/);
  assert.match(packageJson.scripts.backup, /backup-postgres\.js/);
  assert.match(packageJson.scripts.restore, /restore-postgres\.js/);
});

test('scheduled operations have a daily backup and 30-minute shipment sync template', () => {
  assert.match(cron, /schedule: "0 2 \* \* \*"/);
  assert.match(cron, /schedule: "\*\/30 \* \* \* \*"/);
  assert.match(cron, /BACKUP_S3_SECRET_ACCESS_KEY/);
  assert.match(cron, /SHIPBUBBLE_API_KEY/);
});

test('upload middleware is upgraded to the patched 2.5 release line', () => {
  assert.equal(packageJson.dependencies.multer, '^2.5.0');
});
