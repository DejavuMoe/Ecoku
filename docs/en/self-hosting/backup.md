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
install -d -m 700 backups
sudo docker compose stop ecoku
archive="backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
set -- data/ app/config.yaml compose.yaml
if [ -f ecoku.env ]; then set -- "$@" ecoku.env; fi
sudo tar -czf - "$@" > "$archive"
tar -tzf "$archive" >/dev/null
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

The command includes `ecoku.env` if it exists. Archive the entire `data/`, not only the main SQLite file. `Verified backup` means the archive was written and its entries can be read; it is not a restore rehearsal. A failed backup leaves the service stopped. Fix the issue and retry, or resume it with `sudo docker compose up -d ecoku`.

## Restore {#restore}

Stop the service before restoring. Move the current `data/` aside, then extract one complete backup. Do not overwrite a live database or mix newer WAL files with an older database.

Stop the service and restore the complete `data/`, `app/config.yaml`, and `compose.yaml`. Restore `ecoku.env` for an old deployment. Then fix permissions and start:

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

Do not mix a new `data/` directory with an old `ecoku-secrets.json`, and do not restore only the SQLite main file while discarding its matching WAL files. Confirm the admin login, site count, historical comments, and notification settings after restoring.

`ecoku-secrets.json` is as sensitive as the database. Never commit it or place it in a public directory. After the key migration, remove the old environment variables only after a stopped backup.
