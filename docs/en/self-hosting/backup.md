# Backup and restore

All of Ecoku's state is in the deployment directory:

| Path | Contents |
| --- | --- |
| `data/` | The SQLite database (with its `-wal` and `-shm` files) and the key file `ecoku-secrets.json`. Sites, comments, notification and CAPTCHA settings, and the administrator account are all here. |
| `app/config.yaml` | Instance configuration |
| `compose.yaml` | Image version and mounts |

The database and `ecoku-secrets.json` must come from the same point in time. Credentials such as the SMTP password are encrypted with this key; if the two don't match, Ecoku can't start.

## Cold backup {#cold-backup}

Stop the service before archiving so no data still being written is missed:

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

`Verified backup` means the archive was written and its file list can be read. If an older instance still has `ecoku.env`, the script includes it.

The service stays stopped when the script finishes, so you can go on to upgrade or import. For a routine backup only, start it again after confirming success:

```bash
cd ~/Ecoku
sudo docker compose up -d --wait --wait-timeout 120 ecoku
```

Copy the archive to another machine for safekeeping. It is as sensitive as the database: don't commit it to Git or put it in a public directory.

If you customized the database path, back up the whole directory the database is actually in (the key file is in the same directory).

## Restore from backup {#restore}

Restoring discards all comments and settings changes made after the backup.

To restore on a new host, install Docker and Compose first, create `~/Ecoku/backups/` and copy the archive into it. You don't need to start an empty instance first.

Replace `REPLACE-WITH-YOUR-BACKUP.tar.gz` below with your archive's filename. The script checks the archive, stops the service, moves the existing files into a `before-restore.*` directory, then extracts the archive and starts the service. The `compose.yaml` in the archive also restores the image to the version from the time of the backup.

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

After restoring, sign in to the admin console and confirm that sites, past comments, notification and CAPTCHA settings are all there. The health endpoint only shows that the process is running; it doesn't check data.

If any step fails, stop and look at the container logs and the original files in `before-restore.*`. Don't delete the original data and retry.

Two common startup errors:

- `通知凭据校验失败` (notification credential check failed): `ecoku-secrets.json` and the database are not from the same backup.
- `持久密钥文件权限过宽；请设为 600` (key file permissions too broad; set to 600): `ecoku-secrets.json` must have permissions `600`.

## Rollback and schema

Before rolling back to an older version, read the target version's upgrade notes. If the two versions have different schemas, you can only restore from the cold backup taken before the upgrade; see [Upgrading · Rollback](./upgrade#rollback).
