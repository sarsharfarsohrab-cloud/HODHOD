#!/usr/bin/env bash
# Dumps the Hodhod database (accounts, words, cards, history, packs …) and encrypts it.
#   SUPABASE_DB_URL=postgresql://…  BACKUP_PASSPHRASE=…  scripts/backup/backup.sh out-dir
# Needs pg_dump (same or newer major version as the server) and gpg.
set -euo pipefail

out="${1:-backups}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
if [ "${#BACKUP_PASSPHRASE}" -lt 16 ]; then
  echo "BACKUP_PASSPHRASE must be at least 16 characters" >&2
  exit 1
fi

mkdir -p "$out"
stamp="$(date -u +%Y-%m-%d_%H%M)"
plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT

# Our data lives in "public"; accounts (e-mail, password hashes) in "auth".
# Storage files (generated speech) can be regenerated and are not included.
pg_dump "$SUPABASE_DB_URL" \
  --format=custom --compress=9 --no-owner --no-privileges \
  --schema=public --schema=auth \
  --file="$plain"

# a backup that cannot be read back is worse than none: list its contents once
pg_restore --list "$plain" > /dev/null
tables="$(pg_restore --list "$plain" | grep -c ' TABLE DATA ' || true)"

target="$out/hodhod-$stamp.dump.gpg"
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 --output "$target" "$plain" 3<<<"$BACKUP_PASSPHRASE"

echo "backup: $target ($(du -h "$target" | cut -f1), $tables tables with data)"
