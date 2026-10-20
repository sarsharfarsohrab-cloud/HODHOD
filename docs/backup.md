# Backups

Every night GitHub runs `.github/workflows/backup.yml`: it dumps the `public` (words, cards,
history, packs …) and `auth` (accounts) schemas with `pg_dump`, encrypts the file with
AES-256 (`gpg --symmetric`) and keeps it for 30 days as a workflow artifact
(repository → Actions → Backup → a run → Artifacts).

## Setup (once)

1. Supabase → **Connect** (top bar) → **Session pooler** → copy the URI and put your database
   password into it (`postgresql://postgres.<project>:<password>@aws-….pooler.supabase.com:5432/postgres`).
   GitHub's machines have no IPv6, so the direct connection does not work; the session pooler does.
2. GitHub → repository → Settings → Secrets and variables → Actions → New repository secret:
   - `SUPABASE_DB_URL` = that URI
   - `BACKUP_PASSPHRASE` = a long random password (at least 16 characters). Keep it in your
     password manager: **without it a backup cannot be opened.**
3. Actions → Backup → Run workflow, once, to check it works.

The repository is public, so the artifacts can be downloaded by others — that is why they are
encrypted. Generated speech files (storage) are not included; they are recreated on demand.

GitHub pauses scheduled workflows of repositories without any activity for 60 days; it sends
an e-mail first, and one click re-enables it.

## Restore

```bash
BACKUP_PASSPHRASE='…' scripts/backup/restore.sh hodhod-2026-10-20_0217.dump.gpg 'postgresql://…target…'
```

The simplest check is a restore into a local PostgreSQL. Restoring into a Supabase project
(after losing data) is best done step by step: restore `public` first, then the accounts in
`auth` (that schema belongs to Supabase, so restore only its table data:
`pg_restore --data-only --schema=auth …`). The whole round trip is tested by
`scripts/test-backup.sh`.
