const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const server = fs.readFileSync('server.js','utf8');
test('seller workspace profile endpoints match the dashboard API calls',()=>{
 assert.match(server,/app\.get\("\/api\/sellers\/profile",requireSeller/);
 assert.match(server,/app\.patch\("\/api\/sellers\/profile",requireSeller/);
});
test('seller order updates are scoped to orders containing seller-owned items',()=>{
 assert.match(server,/app\.patch\("\/api\/sellers\/orders\/:id",requireSeller/);
 assert.match(server,/EXISTS\(SELECT 1 FROM jsonb_array_elements\(items\) i WHERE \(i->>\'seller_id\'\)::bigint=\$5\)/);
 assert.match(server,/tracking_code=COALESCE/);
});
test('production sessions refuse to start with a known development secret',()=>{
 assert.match(server,/process\.env\.NODE_ENV === "production"[\s\S]*SESSION_SECRET must be configured in production/);
});
test('PostgreSQL backup script requires DATABASE_URL and pg_dump',()=>{
 const script=fs.readFileSync('scripts/backup-postgres.sh','utf8');
 assert.match(script,/DATABASE_URL/); assert.match(script,/pg_dump/);
});
