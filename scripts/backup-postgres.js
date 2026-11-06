#!/usr/bin/env node
'use strict';
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { pipeline } = require('node:stream/promises');
const { Transform } = require('node:stream');
const { createGzip } = require('node:zlib');

const MAGIC = Buffer.from('ZYVB1');
const HEADER_LENGTH = MAGIC.length + 12;
const TAG_LENGTH = 16;

function getEncryptionKey() {
  const raw = String(process.env.BACKUP_ENCRYPTION_KEY || '').trim();
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is required. Generate a random 32-byte key and store it in the host secret manager.');
  const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters or base64.');
  return key;
}

function s3Hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

async function uploadS3(filePath, objectKey) {
  const endpoint = String(process.env.BACKUP_S3_ENDPOINT || '').trim();
  const bucket = String(process.env.BACKUP_S3_BUCKET || '').trim();
  const region = String(process.env.BACKUP_S3_REGION || 'us-east-1').trim();
  const accessKey = String(process.env.BACKUP_S3_ACCESS_KEY_ID || '').trim();
  const secretKey = String(process.env.BACKUP_S3_SECRET_ACCESS_KEY || '').trim();
  if (!endpoint || !bucket || !region || !accessKey || !secretKey) {
    throw new Error('Remote backup requires BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY.');
  }

  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('BACKUP_S3_ENDPOINT must use HTTPS.');
  const prefix = url.pathname.replace(/\/+$/, '');
  const keyPath = objectKey.split('/').map(encodeURIComponent).join('/');
  url.pathname = `${prefix}/${encodeURIComponent(bucket)}/${keyPath}`.replace(/\/+/g, '/');
  url.search = '';
  url.hash = '';

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = `PUT\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
  const kDate = s3Hmac(Buffer.from(`AWS4${secretKey}`), dateStamp);
  const kRegion = s3Hmac(kDate, region);
  const kService = s3Hmac(kRegion, 's3');
  const kSigning = s3Hmac(kService, 'aws4_request');
  const signature = s3Hmac(kSigning, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const stat = await fs.promises.stat(filePath);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      'content-type': 'application/octet-stream',
      'content-length': String(stat.size)
    },
    body: fs.createReadStream(filePath),
    duplex: 'half',
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 500);
    throw new Error(`S3-compatible backup upload failed (${response.status}): ${detail || response.statusText}`);
  }
  return { bucket, objectKey, endpoint: url.origin };
}

async function notifyBackup(event, details) {
  const endpoint = String(process.env.ALERT_WEBHOOK_URL || '').trim();
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `ZYVORA database backup ${event}`, event: `database_backup_${event}`, details, at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    console.error(`Backup alert delivery failed: ${error.message}`);
  }
}

async function pruneLocalBackups(directory) {
  const days = Number(process.env.BACKUP_RETENTION_DAYS || 14);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('BACKUP_RETENTION_DAYS must be an integer between 1 and 365.');
  const cutoff = Date.now() - days * 86400000;
  for (const name of await fs.promises.readdir(directory)) {
    if (!/^zyvora-\d{8}T\d{6}Z\.dump\.gz\.enc$/.test(name)) continue;
    const full = path.join(directory, name);
    const stat = await fs.promises.stat(full);
    if (stat.isFile() && stat.mtimeMs < cutoff) await fs.promises.unlink(full);
  }
}

async function createEncryptedBackup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const hasRemote = ['BACKUP_S3_ENDPOINT', 'BACKUP_S3_BUCKET', 'BACKUP_S3_REGION', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY'].every(k => String(process.env[k] || '').trim());
  if (!hasRemote && !(process.env.BACKUP_LOCAL_ONLY === 'true' && process.env.NODE_ENV !== 'production')) {
    throw new Error('No remote backup destination is configured. For local development only, explicitly set BACKUP_LOCAL_ONLY=true. Production backups must upload off-site.');
  }
  const key = getEncryptionKey();
  const directory = path.resolve(process.env.BACKUP_DIR || './backups');
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const fileName = `zyvora-${stamp}.dump.gz.enc`;
  const target = path.join(directory, fileName);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const output = fs.createWriteStream(target, { flags: 'wx', mode: 0o600 });
  await once(output, 'open');
  const header = Buffer.concat([MAGIC, iv]);
  if (!output.write(header)) await once(output, 'drain');

  const dumpPath = process.env.PG_DUMP_PATH || 'pg_dump';
  const child = spawn(dumpPath, ['--format=custom', '--no-owner', '--no-acl', '--dbname', process.env.DATABASE_URL], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
  const closePromise = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve([code, signal]));
  });
  const appendTag = new Transform({
    transform(chunk, encoding, callback) { callback(null, chunk); },
    flush(callback) { this.push(cipher.getAuthTag()); callback(); }
  });
  try {
    await pipeline(child.stdout, createGzip({ level: 9 }), cipher, appendTag, output);
    const [code, signal] = await closePromise;
    if (code !== 0) throw new Error(`pg_dump failed (${signal || code}): ${stderr.trim() || 'No diagnostic output.'}`);
  } catch (error) {
    child.kill('SIGTERM');
    await closePromise.catch(() => {});
    await fs.promises.unlink(target).catch(() => {});
    throw error;
  }

  const result = { file: target, bytes: (await fs.promises.stat(target)).size };
  if (hasRemote) {
    const prefix = String(process.env.BACKUP_S3_PREFIX || 'zyvora').replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9_./-]/g, '_');
    result.remote = await uploadS3(target, `${prefix}/${fileName}`);
  }
  await pruneLocalBackups(directory);
  return result;
}

if (require.main === module) {
  createEncryptedBackup()
    .then(async result => {
      console.log(JSON.stringify({ level: 'info', event: 'database_backup_complete', ...result }));
      await notifyBackup('succeeded', { file: path.basename(result.file), bytes: result.bytes, remote: result.remote || 'local development only' });
    })
    .catch(async error => {
      console.error(JSON.stringify({ level: 'error', event: 'database_backup_failed', message: error.message }));
      await notifyBackup('failed', { message: error.message });
      process.exitCode = 1;
    });
}

module.exports = { createEncryptedBackup, getEncryptionKey, uploadS3 };
