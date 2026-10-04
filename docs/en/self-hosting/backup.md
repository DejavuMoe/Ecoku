# Backup and restore

All Ecoku state lives in the deployment directory. A complete backup includes at least:

| Path | Contents |
| --- | --- |
| `data/` | The SQLite database with its `-wal` and `-shm` files, plus the persistent keys in `ecoku-secrets.json`. Sites, comments, notification settings, CAPTCHA settings and the administrator account are stored here. |
| `app/config.yaml` | Instance configuration. |
| `compose.yaml` | Image version and mounts. |

If an older instance still uses `ecoku.env`, back it up too: as long as it still holds the legacy administrator credentials or notification encryption key variables, Ecoku reads them on every start.

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

The command includes `ecoku.env` when it exists. Archive the entire `data/`, not only the main SQLite file. `Verified backup` means the archive was written and its entries can be listed; it is not a restore rehearsal. A failed backup leaves the service stopped. Fix the cause and retry, or bring the service back with `sudo docker compose up -d ecoku`.

## Restore {#restore}

1. Stop the service and move the current `data/` to another directory.
2. Extract `data/`, `app/config.yaml` and `compose.yaml` from one complete backup; on an older instance, restore `ecoku.env` as well.
3. Fix permissions and start:

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

Do not overwrite a running database, and do not mix files from different points in time: newer WAL files do not belong with an older database, and a newer `data/` does not belong with an older `ecoku-secrets.json`. When the keys do not match the database, the saved notification credentials cannot be decrypted and the service exits at startup with `通知凭据校验失败`. `ecoku-secrets.json` must grant no permissions to the group or others; otherwise startup fails with `持久密钥文件权限过宽；请设为 600`.

After restoring, confirm that you can sign in to the admin console, that the site count is right, and that past comments and notification settings are present.

## Backup rules

- `ecoku-secrets.json` is as sensitive as the database. Never commit it to Git or place it in a public directory.
- After legacy variables such as `ECOKU_NOTIFICATION_ENCRYPTION_KEY` have moved into the persistent key file, take a stopped backup first, then remove them from Compose or `ecoku.env`.
- Read the target version's upgrade notes before rolling back. When the schema differs, only the cold backup taken before the upgrade can restore the instance.
