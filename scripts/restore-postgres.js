#!/usr/bin/env node
'use strict';
require('dotenv').config();

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');

const MAGIC = Buffer.from('ZYVB1');
const HEADER_LENGTH = MAGIC.length + 12;
const TAG_LENGTH = 16;

function getKey() {
  const raw = String(process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return key;
}

async function restore() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: npm run restore -- <backup-file> (requires RESTORE_CONFIRM=YES).');
  if (process.env.RESTORE_CONFIRM !== 'YES') throw new Error('Restore is destructive. Set RESTORE_CONFIRM=YES only after verifying the target database and backup file.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const stat = await fs.promises.stat(file);
  if (!stat.isFile() || stat.size <= HEADER_LENGTH + TAG_LENGTH) throw new Error('Backup file is missing or too small.');
  const handle = await fs.promises.open(file, 'r');
  const header = Buffer.alloc(HEADER_LENGTH);
  const tag = Buffer.alloc(TAG_LENGTH);
  try {
    await handle.read(header, 0, HEADER_LENGTH, 0);
    await handle.read(tag, 0, TAG_LENGTH, stat.size - TAG_LENGTH);
  } finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unknown backup file format.');
  const iv = header.subarray(MAGIC.length);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const temp = path.join(os.tmpdir(), `zyvora-restore-${process.pid}-${Date.now()}.dump`);
  try {
    const encrypted = fs.createReadStream(file, { start: HEADER_LENGTH, end: stat.size - TAG_LENGTH - 1 });
    await pipeline(encrypted, decipher, createGunzip(), fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    const restoreCommand = process.env.PG_RESTORE_PATH || 'pg_restore';
    const child = spawn(restoreCommand, ['--clean', '--if-exists', '--exit-on-error', '--no-owner', '--no-acl', '--dbname', process.env.DATABASE_URL, temp], { stdio: 'inherit' });
    const [code, signal] = await once(child, 'close');
    if (code !== 0) throw new Error(`pg_restore failed (${signal || code}).`);
    console.log('Database restore completed.');
  } finally { await fs.promises.unlink(temp).catch(() => {}); }
}

if (require.main === module) restore().catch(error => { console.error(`Restore failed: ${error.message}`); process.exitCode = 1; });
module.exports = { restore };
