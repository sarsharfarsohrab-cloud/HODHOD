#!/usr/bin/env bash
# Checks that a backup made by scripts/backup/backup.sh can be decrypted and restored:
# migrations + a little data in a throw-away PostgreSQL → backup → restore into a second
# database → the data is there. No Supabase project is touched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${PG_BIN:-$(dirname "$(command -v initdb || echo /usr/lib/postgresql/16/bin/initdb)")}"
DIR="$(mktemp -d)"
OUT="$(mktemp -d)"
PORT="${PG_TEST_PORT:-54331}"
RUN=()
if [ "$(id -u)" = "0" ]; then
  chown nobody "$DIR"
  RUN=(runuser -u nobody --)
fi
cleanup() { "${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR" "$OUT"; }
trap cleanup EXIT

"${RUN[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -c listen_addresses='' -k $DIR" -l "$DIR/log" -w start >/dev/null
PSQL=("$BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$DIR" -p "$PORT" -U postgres)

"${PSQL[@]}" -d postgres < "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -d postgres < "$f"; done
"${PSQL[@]}" -d postgres <<'SQL'
insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'backup@example.test');
insert into public.words (user_id, target_language, native_language, lemma, normalized_lemma, pos, primary_meaning, content)
values ('11111111-1111-4111-8111-111111111111', 'de', 'fa', 'Tisch', 'Tisch', 'noun', 'میز', '{"lemma": "Tisch"}');
SQL

export SUPABASE_DB_URL="postgresql://postgres@/postgres?host=$DIR&port=$PORT"
export BACKUP_PASSPHRASE="a-long-test-passphrase-0123456789"
"$ROOT/scripts/backup/backup.sh" "$OUT"
file="$(ls "$OUT"/*.dump.gpg)"

# the file is really encrypted: no German word in plain text
if grep -q "Tisch" "$file"; then echo "FAIL: backup is not encrypted" >&2; exit 1; fi
# a wrong passphrase does not open it
if BACKUP_PASSPHRASE="wrong-passphrase-0123456789" "$ROOT/scripts/backup/restore.sh" "$file" "x" 2>/dev/null; then echo "FAIL: wrong passphrase accepted" >&2; exit 1; fi

"${PSQL[@]}" -d postgres -c "create database restored"
"${PSQL[@]}" -d restored < "$ROOT/tests/db/00_supabase_stub.sql" 2>/dev/null || true
"$ROOT/scripts/backup/restore.sh" "$file" "postgresql://postgres@/restored?host=$DIR&port=$PORT" >/dev/null
words="$("${PSQL[@]}" -d restored -tA -c "select count(*) from public.words where lemma = 'Tisch'")"
cards="$("${PSQL[@]}" -d restored -tA -c "select count(*) from public.cards")"
users="$("${PSQL[@]}" -d restored -tA -c "select count(*) from auth.users")"
[ "$words" = "1" ] && [ "$cards" = "1" ] && [ "$users" = "1" ] || { echo "FAIL: restored words=$words cards=$cards users=$users" >&2; exit 1; }
echo "backup test passed (encrypted, wrong passphrase refused, restored words=$words cards=$cards users=$users)"
