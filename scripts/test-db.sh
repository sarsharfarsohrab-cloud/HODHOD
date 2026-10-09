#!/usr/bin/env bash
# Applies the migrations to a throw-away local PostgreSQL and runs tests/db/*.sql against it.
# Needs the PostgreSQL server binaries (initdb, pg_ctl); no Supabase project is touched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}"
DIR="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54329}"
RUN=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL refuses to run as root
  PG_USER="${PG_TEST_OS_USER:-nobody}"
  chown "$PG_USER" "$DIR"
  RUN=(runuser -u "$PG_USER" --)
fi
cleanup() { "${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT

"${RUN[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
PSQL=("${RUN[@]}" "$BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORT" -U postgres -d postgres)

"${PSQL[@]}" < "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" < "$f"; done
for f in "$ROOT"/tests/db/[1-9]*.sql; do "${PSQL[@]}" -t < "$f"; done
