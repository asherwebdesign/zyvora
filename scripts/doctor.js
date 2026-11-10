'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const { createDatabaseConfig } = require('../database-config');

async function main() {
  let config;
  try {
    config = createDatabaseConfig(process.env);
  } catch (error) {
    console.error(`CONFIGURATION ERROR: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const parsed = new URL(config.connectionString);
  console.log('ZYVORA database connection check');
  console.log(`Target host: ${parsed.hostname}`);
  console.log(`Target port: ${parsed.port || '5432 (default)'}`);
  console.log(`Target database: ${decodeURIComponent(parsed.pathname.slice(1))}`);
  console.log('Credentials: hidden');

  const pool = new Pool({ ...config, max: 1 });
  try {
    const result = await pool.query('SELECT current_database() AS database, current_user AS username, NOW() AS checked_at');
    console.log('DATABASE CONNECTION: OK');
    console.log(`Connected database: ${result.rows[0].database}`);
    console.log(`Database user: ${result.rows[0].username}`);
    console.log('The database is reachable. The application will apply schema.sql on startup.');
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      console.warn('WARNING: Set SESSION_SECRET to a random secret at least 32 characters long.');
    }
    if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)) {
      console.warn('WARNING: ADMIN_EMAIL and ADMIN_PASSWORD are not set. No first admin account will be bootstrapped.');
    }
  } catch (error) {
    console.error(`DATABASE CONNECTION: FAILED (${error.code || 'unknown'})`);
    if (error.code === 'ECONNREFUSED') {
      console.error('The host/port refused the connection. Check that PostgreSQL is running and that DATABASE_URL targets the correct server.');
    } else if (error.code === '28P01') {
      console.error('PostgreSQL rejected the credentials. Check the username and password in your private .env file.');
    } else if (error.code === '3D000') {
      console.error('The database name in DATABASE_URL does not exist. Create it in pgAdmin or correct the URL.');
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Database check failed: ${error.message}`);
  process.exitCode = 1;
});
