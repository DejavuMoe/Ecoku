# Backup and restore

With the default Compose mounts, persistent state is in the deployment directory. A complete backup includes at least:

| Path | Contents |
| --- | --- |
| `data/` | The SQLite database with its `-wal` and `-shm` files, plus the persistent keys in `ecoku-secrets.json`. Sites, comments, notification settings, CAPTCHA settings and the administrator account are stored here. |
| `app/config.yaml` | Instance configuration. |
| `compose.yaml` | Image version and mounts. |

If an older instance still uses `ecoku.env`, back it up too: as long as it still holds the legacy administrator credentials or notification encryption key variables, Ecoku reads them on every start.

For a custom SQLite path, back up its actual directory and the keys beside it, and retain the matching mounts. Securely preserve any additional `env_file` or credentials injected from the host environment as well. The script below covers only the default paths above and the optional `ecoku.env`.

## Cold backup {#cold-backup}

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 backups
sudo docker compose stop ecoku
archive=$(mktemp "backups/ecoku-$(date +%Y%m%d_%H%M%S)-XXXXXX.tar.gz")
set -- data/ app/config.yaml compose.yaml
if [ -f ecoku.env ]; then set -- "$@" ecoku.env; fi
sudo tar -czf - "$@" > "$archive"
tar -tzf "$archive" >/dev/null
printf 'Verified backup: %s\n' "$archive"
)
```

The command includes `ecoku.env` when present and chooses an archive name without overwriting an existing file. Archive the entire `data/`, not only the main SQLite file. `Verified backup` means the archive was written and its entries can be listed; it is not a restore rehearsal.

**The service stays stopped after backup.** Continue with the upgrade, import or restore steps to avoid new writes after the backup. For a routine backup only, resume service after confirming success:

```bash
cd ~/Ecoku
sudo docker compose up -d --wait --wait-timeout 120 ecoku
```

## Restore {#restore}

To restore on a new host, first install Docker and Compose, create `~/Ecoku/backups/`, and copy the complete archive there. Do not initialize an empty instance or generate new keys first.

Choose a complete cold backup you saved and replace `REPLACE-WITH-YOUR-BACKUP.tar.gz` with its filename. The script checks the archive, stops the service, retains current data and configuration in a `before-restore.*` directory, then restores the archive and waits for health. The restored `compose.yaml` also restores the image version recorded in the backup.

```bash
(
set -eu
cd "$HOME/Ecoku"
archive="$PWD/backups/REPLACE-WITH-YOUR-BACKUP.tar.gz"
test -f "$archive"
tar -tzf "$archive" >/dev/null
if [ -f compose.yaml ]; then sudo docker compose stop ecoku; fi
saved=$(mktemp -d "$PWD/before-restore.XXXXXX")
for path in data app compose.yaml ecoku.env; do
  if [ -e "$path" ]; then sudo mv -- "$path" "$saved/"; fi
done
sudo tar -xzf "$archive" -C "$PWD"
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo chown "$(id -u):$(id -g)" app app/config.yaml
sudo chmod 755 app
sudo chmod 644 app/config.yaml
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
printf '\nPrevious files retained in: %s\n' "$saved"
)
```

Do not overwrite a running database, and do not mix files from different points in time: newer WAL files do not belong with an older database, and a newer `data/` does not belong with an older `ecoku-secrets.json`. When the keys do not match the database, the saved notification credentials cannot be decrypted and the service exits at startup with `通知凭据校验失败`. `ecoku-secrets.json` must grant no permissions to the group or others; otherwise startup fails with `持久密钥文件权限过宽；请设为 600`.

Restoring discards comments and settings changes made after the backup. Confirm that you can sign in, that the site count is right, and that past comments, notification and CAPTCHA settings are present; the health endpoint does not inspect database contents. If any step fails, stop and inspect container logs and the retained `before-restore.*` directory rather than deleting the original data and retrying.

## Backup rules

- `ecoku-secrets.json` is as sensitive as the database. Never commit it to Git or place it in a public directory.
- After legacy variables such as `ECOKU_NOTIFICATION_ENCRYPTION_KEY` have moved into the persistent key file, take a stopped backup first, then remove them from Compose or `ecoku.env`.
- Read the target version's upgrade notes before rolling back. When the schema differs, only the cold backup taken before the upgrade can restore the instance.
