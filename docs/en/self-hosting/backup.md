# Backup and restore

A new deployment needs a backup of:

| Path | Contents |
| --- | --- |
| `data/` | SQLite, `-wal`, `-shm`, and `ecoku-secrets.json`. Sites, comments, notifications, CAPTCHA, and the administrator account are here. |
| `app/config.yaml` | Instance configuration. |
| `compose.yaml` | Image version and mounts. |

If an old deployment still uses `ecoku.env`, include it until the migration is complete. The old administrator credentials and notification encryption key may still be read from it.

## Cold backup {#cold-backup}

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
sudo tar -czf - data/ app/config.yaml compose.yaml ${ECOKU_BACKUP_ENV:-} > "$archive"
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

For an old deployment, set `ECOKU_BACKUP_ENV=ecoku.env` before creating the archive. Do not set it for a new deployment. Pack the entire `data/` directory; the WAL files and persistent keys are part of the state.

## Restore {#restore}

Stop the service and restore the complete `data/`, `app/config.yaml`, and `compose.yaml`. Restore `ecoku.env` for an old deployment. Then fix permissions and start:

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

Do not mix a new `data/` directory with an old `ecoku-secrets.json`, and do not restore only the SQLite main file while discarding its matching WAL files. Confirm the admin login, site count, historical comments, and notification settings after restoring.

`ecoku-secrets.json` is as sensitive as the database. Never commit it or place it in a public directory. After the key migration, remove the old environment variables only after a stopped backup.
