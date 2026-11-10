const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabaseConfig } = require('../database-config');

const local = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:example-pass@localhost:5432/zyvora'
};

test('Build 17 requires an explicit DATABASE_URL instead of pg defaulting to localhost', () => {
  assert.throws(() => createDatabaseConfig({ NODE_ENV: 'development' }), /DATABASE_URL is missing/);
});

test('Build 17 accepts the lowercase local ZYVORA database name', () => {
  const config = createDatabaseConfig(local);
  assert.equal(new URL(config.connectionString).pathname, '/zyvora');
  assert.equal(config.ssl, false);
  assert.equal(config.connectionTimeoutMillis, 10000);
});

test('Build 17 blocks localhost PostgreSQL in production with a useful Render instruction', () => {
  assert.throws(
    () => createDatabaseConfig({ ...local, NODE_ENV: 'production' }),
    /cannot reach PostgreSQL running on your personal computer.*Internal Database URL/s
  );
});

test('Build 17 accepts a remote production PostgreSQL URL and enables TLS', () => {
  const config = createDatabaseConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://zyvora:secret@dpg-example-a.oregon-postgres.render.com:5432/zyvora'
  });
  assert.equal(new URL(config.connectionString).hostname, 'dpg-example-a.oregon-postgres.render.com');
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});

test('Build 17 rejects malformed and non-PostgreSQL database URLs', () => {
  assert.throws(() => createDatabaseConfig({ DATABASE_URL: 'not-a-url' }), /not a valid PostgreSQL/);
  assert.throws(() => createDatabaseConfig({ DATABASE_URL: 'https://example.com/db' }), /must use the postgresql/);
});

test('Build 17 never seeds unverified sample products unless explicitly opted in', () => {
  const server = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /if\s*\(String\(process\.env\.SEED_SAMPLE_PRODUCTS\)\.toLowerCase\(\)\s*===\s*"true"\)/);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '.env.example'), 'utf8'), /SEED_SAMPLE_PRODUCTS=false/);
});
