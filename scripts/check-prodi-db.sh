#!/usr/bin/env bash
# Applies every migration to a throwaway Postgres in Docker and runs scripts/check-prodi-db.sql.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME=krs-prodi-check
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pg postgres:16 >/dev/null
trap 'docker rm -f "$NAME" >/dev/null' EXIT

# The image runs a temporary server during init, then restarts; wait for the real one.
until docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete" && docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

run < scripts/db-stub.sql
for f in supabase/migrations/*.sql; do
  case "$f" in *audit_log_retention*) continue ;; esac # pg_cron exists only on Supabase
  run < "$f"
done
run < scripts/check-prodi-db.sql
echo "prodi db: all checks passed"
