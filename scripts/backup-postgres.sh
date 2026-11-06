#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL before running a backup}"
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is required. Install PostgreSQL client tools." >&2; exit 1; }
# pg_dump is invoked by backup-postgres.js. This wrapper remains for existing operator runbooks.
exec node "$(dirname "$0")/backup-postgres.js"
