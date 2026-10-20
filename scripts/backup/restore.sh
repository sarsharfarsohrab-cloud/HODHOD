#!/usr/bin/env bash
# Decrypts a backup made by backup.sh and restores it into a database.
#   BACKUP_PASSPHRASE=…  scripts/backup/restore.sh hodhod-2026-10-20_0317.dump.gpg postgresql://…target…
# Restore into a NEW, empty Supabase project (or a local database) — never over the live one
# without a reason. Tables that already exist are replaced (--clean).
set -euo pipefail

file="${1:?backup file (.dump.gpg)}"
target="${2:?target database URL}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"

plain="$(mktemp)"
trap 'rm -f "$plain"' EXIT
gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt --output "$plain" "$file" 3<<<"$BACKUP_PASSPHRASE"
pg_restore --dbname="$target" --clean --if-exists --no-owner --no-privileges --single-transaction "$plain"
echo "restored $file"
