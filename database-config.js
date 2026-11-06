'use strict';

/**
 * Build 17 centralises PostgreSQL configuration and prevents the production
 * server from silently falling back to its own localhost:5432 instance.
 */
function createDatabaseConfig(env = process.env) {
  const raw = String(env.DATABASE_URL || '').trim();
  if (!raw) {
    throw new Error(
      'DATABASE_URL is missing. For local use, copy .env.example to .env and set your PostgreSQL URL. ' +
      'For Render, set DATABASE_URL to the cloud database Internal Database URL.'
    );
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection URL. Expected postgresql://USER:PASSWORD@HOST:5432/DATABASE.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL must use the postgresql:// or postgres:// protocol.');
  }
  if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('DATABASE_URL must include a database host and database name.');
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (String(env.NODE_ENV).toLowerCase() === 'production' && localHosts.has(host)) {
    throw new Error(
      'DATABASE_URL points to localhost, but a Render web service cannot reach PostgreSQL running on your personal computer. ' +
      'Set DATABASE_URL to the Internal Database URL of a cloud PostgreSQL database in the same Render region.'
    );
  }

  if (!parsed.username || !parsed.password) {
    throw new Error('DATABASE_URL must include the PostgreSQL username and password.');
  }

  return {
    connectionString: raw,
    ssl: String(env.NODE_ENV).toLowerCase() === 'production' ? { rejectUnauthorized: false } : false,
    max: Number(env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true
  };
}

module.exports = { createDatabaseConfig };
